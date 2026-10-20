/* Verifikasi kode hasil generate: tulis modul kaya ke src/modules/verifygen-tmp/,
 * typecheck proyek, lalu hapus lagi (try/finally agar tak ada residu).
 * Dijalankan via `npm run verify:generator` setelah emission.mjs.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const ROOT = join(fileURLToPath(new URL('../..', import.meta.url)));
const TMP_PREFIX = 'src/modules/verifygen-tmp';
const TARGET_PREFIX = 'src/modules/verifygen-target';
const jiti = createJiti(import.meta.url);
const { generateModule } = jiti(`${ROOT}/src/modules/generator/engine/moduleGenerator.ts`);

// Target relasi digenerate juga agar verifikasi self-contained (tidak bergantung
// pada modul hasil publish-ke-repo yang bisa dihapus user).
const targetConfig = {
  parentName: null,
  moduleName: 'Verifygen Target',
  type: 'crud',
  permissionKey: 'verifygentarget',
  features: { list: true, detail: true, create: true, edit: true, delete: true, bulkUpload: true, export: true },
  fields: [
    { name: 'name', label: 'Name', type: 'textField', rules: ['required'], sortable: true, filterable: true, filterCriteria: 'contains', source: 'none' },
  ],
};

const config = {
  parentName: null,
  moduleName: 'Verifygen Tmp',
  type: 'crud',
  permissionKey: 'verifygentmp',
  features: { list: true, detail: true, create: true, edit: true, delete: true, bulkUpload: true, export: true },
  formLayout: [
    { field: 'section-1', order: 0, colSpan: 12, kind: 'section', label: 'Data Umum' },
    { field: 'itemName', order: 1, colSpan: 6 },
    { field: 'seller', order: 2, colSpan: 6 },
    { field: 'category', order: 3, colSpan: 6 },
    { field: 'divider-1', order: 4, colSpan: 12, kind: 'divider' },
    { field: 'warna', order: 5, colSpan: 12 },
    { field: 'deskripsi', order: 6, colSpan: 12 },
    { field: 'dokumen', order: 7, colSpan: 12 },
    { field: 'items', order: 8, colSpan: 12 },
  ],
  fields: [
    { name: 'itemName', label: 'Item Name', type: 'textField', rules: ['required'], sortable: true, filterable: true, filterCriteria: 'contains', source: 'none' },
    { name: 'seller', label: 'Seller', type: 'selectField', rules: [], sortable: true, filterable: true, filterCriteria: 'optionExact', source: 'mockPagingInfinityScroll' },
    { name: 'category', label: 'Category', type: 'selectField', rules: [], sortable: false, filterable: true, filterCriteria: 'optionExact', source: 'relation', relation: { definitionKey: 'verifygen-target', labelField: 'name', valueField: 'id' } },
    { name: 'warna', label: 'Warna', type: 'colorField', rules: [], sortable: true, filterable: true, filterCriteria: 'contains', source: 'none', componentProps: { color: { size: 'lg' } } },
    { name: 'deskripsi', label: 'Deskripsi', type: 'editorField', rules: [], sortable: true, filterable: false, filterCriteria: null, source: 'none' },
    { name: 'dokumen', label: 'Dokumen', type: 'fileUploadField', rules: [], sortable: false, filterable: false, filterCriteria: null, source: 'none', componentProps: { upload: { multiple: true } } },
    {
      name: 'items', label: 'Items', type: 'formArrayField', rules: ['required', 'min:1'], sortable: false, filterable: false, filterCriteria: null, source: 'none',
      componentProps: { array: { addLabel: 'Tambah Barang', maxRows: 10 } },
      subFields: [
        { name: 'namaBarang', label: 'Nama Barang', type: 'textField', rules: ['required', 'withoutemoticon'], source: 'none' },
        { name: 'qty', label: 'Qty', type: 'numberField', rules: [], source: 'none' },
        { name: 'kondisi', label: 'Kondisi', type: 'selectField', rules: [], source: 'mockStatic', options: [{ label: 'Baru', value: 'baru' }, { label: 'Bekas', value: 'bekas' }] },
        { name: 'nota', label: 'Nota', type: 'fileUploadField', rules: [], source: 'none' },
      ],
    },
  ],
};

if (existsSync(join(ROOT, TMP_PREFIX)) || existsSync(join(ROOT, TARGET_PREFIX))) {
  console.log(`COMPILE FAIL: dir tmp sudah ada — hapus dulu (residu run gagal).`);
  process.exit(1);
}
const files = [...generateModule(targetConfig), ...generateModule(config)];
const allowed = (p) => p.startsWith(`${TMP_PREFIX}/`) || p.startsWith(`${TARGET_PREFIX}/`);
const outside = files.filter((f) => !allowed(f.path));
if (outside.length > 0 || files.length === 0) {
  console.log('COMPILE FAIL: path hasil generate di luar dir tmp.', outside.map((f) => f.path));
  process.exit(1);
}
try {
  for (const f of files) {
    const abs = join(ROOT, f.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.content);
  }
  execFileSync('npx', ['tsc', '-b'], { cwd: ROOT, stdio: 'pipe' });
  console.log(`COMPILE PASS (${files.length} file)`);
} catch (err) {
  const out = [err.stdout?.toString(), err.stderr?.toString()].filter(Boolean).join('\n');
  console.log('COMPILE FAIL: tsc error pada kode hasil generate.\n' + out.split('\n').slice(0, 25).join('\n'));
  process.exitCode = 1;
} finally {
  rmSync(join(ROOT, TMP_PREFIX), { recursive: true, force: true });
  rmSync(join(ROOT, TARGET_PREFIX), { recursive: true, force: true });
}
