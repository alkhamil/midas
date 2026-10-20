/* Verifikasi emisi template + runtime generator (node only, tanpa browser).
 * Dijalankan via `npm run verify:generator`. Gagal (exit 1) bila ada ekspektasi
 * yang tidak terpenuhi. Cakupan: snippet FormItem/tabel/detail/rules/mapper/mock
 * untuk color/editor/upload-multiple/form-array + helper runtime baris.
 */
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const ROOT = new URL('../..', import.meta.url).pathname;
const fg = jiti(`${ROOT}/src/modules/generator/engine/fieldGenerator.ts`);
const naming = jiti(`${ROOT}/src/modules/generator/naming.ts`);
const vg = jiti(`${ROOT}/src/modules/generator/engine/validationGenerator.ts`);
const sg = jiti(`${ROOT}/src/modules/generator/engine/sourceGenerator.ts`);
const parser = jiti(`${ROOT}/src/modules/generator/parser.ts`);
const cp = jiti(`${ROOT}/src/modules/generator/componentProps.ts`);
const vr = jiti(`${ROOT}/src/modules/generator/runtime/validation.ts`);
const utils = jiti(`${ROOT}/src/shared/utils/index.ts`);

const ctx = { names: { testId: 'demo' }, config: { permissionKey: 'demo' } };
const base = {
  name: 'x',
  pascal: 'X',
  valueType: 'string',
  formType: 'string',
  isSelect: false,
  isOptionField: false,
  isMultiOption: false,
  isOptionsQuery: false,
  isLoadOptions: false,
  rulesVar: 'rules',
  optionType: '',
  mockOptionsVar: '',
  optionsQueryHook: '',
  loadOptionsFn: '',
  sortable: false,
  filterable: false,
  filterCriteria: null,
};
const F = (name, label, config) => ({
  ...base,
  name,
  label,
  config: { name, rules: [], label, ...config },
});

let fail = 0;
function expectIn(hay, needle, tag) {
  if (!hay.includes(needle)) {
    fail++;
    console.log('MISS', tag, JSON.stringify(needle), '\n' + hay);
  }
}
function expectEq(actual, expected, tag) {
  if (actual !== expected) {
    fail++;
    console.log('MISS', tag, 'got', JSON.stringify(actual), 'want', JSON.stringify(expected));
  }
}

// --- Fase C: color/editor/upload-multiple ---
const color = fg.formItemSnippet(ctx, F('warna', 'Warna', { type: 'colorField', componentProps: { color: { size: 'lg' } } }));
expectIn(color, 'component={ColorField}', 'color-component');
expectIn(color, 'size="lg"', 'color-size');
expectIn(fg.formItemSnippet(ctx, F('deskripsi', 'Deskripsi', { type: 'editorField' })), 'component={EditorField}', 'editor-component');
const upMulti = fg.formItemSnippet(ctx, F('lampiran', 'Lampiran', { type: 'fileUploadField', componentProps: { upload: { multiple: true } } }));
expectIn(upMulti, 'multiple', 'upload-multiple');
const upSingle = fg.formItemSnippet(ctx, F('dok', 'Dok', { type: 'fileUploadField' }));
if (upSingle.includes('multiple')) {
  fail++;
  console.log('UNEXPECTED multiple in single upload');
}
expectIn(fg.tableColumnSnippet(F('warna', 'Warna', { type: 'colorField' })), 'backgroundColor', 'color-cell');
expectIn(fg.tableColumnSnippet(F('deskripsi', 'Deskripsi', { type: 'editorField' })), 'stripHtml', 'editor-cell');
expectIn(fg.detailRowSnippet(F('warna', 'Warna', { type: 'colorField' })), 'backgroundColor', 'color-detail');
expectIn(fg.detailRowSnippet(F('deskripsi', 'Deskripsi', { type: 'editorField' })), 'stripHtml', 'editor-detail');
const multiModel = F('lampiran', 'Lampiran', { type: 'fileUploadField', componentProps: { upload: { multiple: true } } });
multiModel.valueType = 'file';
multiModel.formType = 'file';
expectEq(fg.tsFormType(multiModel), 'File | File[] | null', 'tsFormType-multiple');
expectIn(fg.payloadMapping(multiModel), 'Array.isArray', 'payload-multiple');
expectEq(cp.propsKeyForType('colorField'), 'color', 'propsKey-color');
expectEq(cp.propsKeyForType('editorField'), 'editor', 'propsKey-editor');
expectEq(utils.stripHtml('<p>Halo <b>Dunia</b></p>'), 'Halo Dunia', 'stripHtml');

// --- Fase D: form array ---
const subName = { name: 'namaBarang', label: 'Nama Barang', type: 'textField', rules: ['required'], source: 'none' };
const subQty = { name: 'qty', label: 'Qty', type: 'numberField', rules: [], source: 'none' };
const subFile = { name: 'nota', label: 'Nota', type: 'fileUploadField', rules: [], source: 'none' };
const arrayModel = {
  ...base,
  name: 'items',
  label: 'Items',
  pascal: 'Items',
  valueType: 'rowArray',
  formType: 'rowArray',
  rulesVar: 'itemsRules',
  config: {
    name: 'items',
    label: 'Items',
    rules: ['required', 'min:1'],
    type: 'formArrayField',
    subFields: [subName, subQty, subFile],
  },
};
expectIn(fg.formItemSnippet(ctx, arrayModel), 'component={ItemsArrayInput}', 'array-input');
expectIn(fg.formItemSnippet(ctx, arrayModel), 'editorTitle="Items"', 'array-editor-title');
expectIn(fg.rowInterfacesSnippet(arrayModel), 'export interface ItemsRow extends Record<string, unknown>', 'row-iface');
expectIn(fg.rowInterfacesSnippet(arrayModel), 'qty: number;', 'row-iface-num');
expectIn(fg.rowInterfacesSnippet(arrayModel), 'nota: File | null;', 'rowform-file');
expectIn(fg.rowMappersSnippet(arrayModel), "String(row?.qty ?? '')", 'mapper-num-form');
expectIn(fg.rowMappersSnippet(arrayModel), 'parseCurrency(form.qty)', 'mapper-num-data');
expectIn(fg.arrayColumnsSnippet(arrayModel), 'const ItemsArrayColumns: Column<ItemsRow>[]', 'array-cols');
expectIn(fg.arrayInputSnippet(ctx, arrayModel), 'function ItemsRowEditor', 'row-editor');
expectIn(fg.arrayInputSnippet(ctx, arrayModel), 'testId="demo-items-namaBarang"', 'sub-testid');
expectIn(
  fg.arrayInputSnippet(ctx, arrayModel),
  "t('validation.required', { label: t('demo.fields.items.sub.namaBarang.label') })",
  'sub-rules',
);
expectIn(fg.tableColumnSnippet(arrayModel), "t('system.rowCount'", 'array-cell');
expectIn(fg.detailRowSnippet(arrayModel), "t('system.rowCount'", 'array-detail');
// Select tampil label opsi di tabel/detail: map statis → literal, paging → helper api.
const selStatic = F('status', 'Status', {
  type: 'selectField',
  source: 'mockStatic',
  options: [
    { label: 'Aktif', value: 'active' },
    { label: "Nonaktif", value: 'inactive' },
  ],
});
expectIn(fg.tableColumnSnippet(selStatic), "'active': 'Aktif'", 'table-static-label');
expectIn(fg.detailRowSnippet(selStatic), "'active': 'Aktif'", 'detail-static-label');
const selLoad = {
  ...base,
  name: 'seller',
  label: 'Seller',
  pascal: 'Seller',
  isLoadOptions: true,
  config: { name: 'seller', rules: [], label: 'Seller', type: 'selectField', source: 'mockPagingInfinityScroll' },
};
expectIn(fg.tableColumnSnippet(selLoad), 'getSellerOptionLabel(row.seller)', 'table-load-label');
expectIn(fg.detailRowSnippet(selLoad), 'getSellerOptionLabel(item.seller)', 'detail-load-label');
expectEq(fg.loadLabelHelpers([selLoad]).join(','), 'getSellerOptionLabel', 'label-helpers');
// Sub-field paging: kolom array memakai helper, import capitalize tak ikut.
const subLoad = { name: 'product', label: 'Product', type: 'selectField', rules: [], source: 'mockPagingInfinityScroll' };
const arrayLoadModel = {
  ...arrayModel,
  config: { ...arrayModel.config, subFields: [subLoad] },
};
expectEq(fg.arrayColumnUtils(arrayLoadModel).includes('capitalize'), false, 'array-utils-no-cap-paging');
expectIn(fg.arrayColumnsSnippet(arrayLoadModel), 'getItemsProductOptionLabel(row.product)', 'array-sub-load-label');
// Sub-field opsi statis: map literal + fallback capitalize tetap butuh import.
const subStatic = { name: 'kondisi', label: 'Kondisi', type: 'selectField', rules: [], source: 'mockStatic', options: [{ label: 'Baru', value: 'baru' }] };
const arrayStaticModel = {
  ...arrayModel,
  config: { ...arrayModel.config, subFields: [subStatic] },
};
expectEq(fg.arrayColumnUtils(arrayStaticModel).includes('capitalize'), true, 'array-utils-cap-static');
expectIn(fg.arrayColumnsSnippet(arrayStaticModel), "'baru': 'Baru'", 'array-sub-static-label');
// Relasi: resolve target + kolom/detail memakai RelationLabel + loader terdaftar.
const relTarget = naming.resolveRelationTarget({ definitionKey: 'catalogue/category', labelField: 'name', valueField: 'id' });
expectEq(relTarget?.mockListFn, 'mockGetCategories', 'relation-mock-fn');
expectEq(relTarget?.mockImportPath, '../../catalogue/category/api/mock', 'relation-import-path');
expectEq(relTarget?.targetDir, 'src/modules/catalogue/category', 'relation-target-dir');
expectEq(
  naming.relativeModulePath('src/modules/store-test/api/mock.ts', 'src/modules/master-data/region/api/mock'),
  '../../master-data/region/api/mock',
  'relation-path-flat',
);
expectEq(
  naming.relativeModulePath('src/modules/master-data/vendor/api/mock.ts', 'src/modules/master-data/region/api/mock'),
  '../../region/api/mock',
  'relation-path-nested',
);
const relField = {
  ...base,
  name: 'category',
  label: 'Category',
  pascal: 'Category',
  isRelationOptions: true,
  loadOptionsFn: 'loadCategoryOptions',
  config: { name: 'category', rules: [], label: 'Category', type: 'selectField', source: 'relation', relation: { definitionKey: 'catalogue/category', labelField: 'name', valueField: 'id' } },
};
expectIn(fg.tableColumnSnippet(relField), '<RelationLabel loader={loadCategoryOptions} value={row.category} />', 'table-relation-label');
expectIn(fg.detailRowSnippet(relField), '<RelationLabel loader={loadCategoryOptions} value={item.category} />', 'detail-relation-label');
expectEq(fg.relationLoaders([relField]).join(','), 'loadCategoryOptions', 'relation-loaders');
expectIn(sg.mockRelationOptionsFn(relField), 'mockGetCategories({ search: search || undefined', 'relation-mock-loader');
expectIn(
  sg.mockRelationOptionsImport(relField, 'src/modules/master-data/vendor/'),
  "from '../../../catalogue/category/api/mock'",
  'relation-import-nested-consumer',
);
expectEq(fg.tsDataType(arrayModel), 'ItemsRow[]', 'tsDataType-array');
expectEq(fg.tsFormType(arrayModel), 'ItemsRow[]', 'tsFormType-array');
expectEq(fg.formDefaultValue(arrayModel), '[]', 'formDefault-array');
expectEq(fg.payloadMapping(arrayModel), 'data.items', 'payload-array');
expectIn(vg.buildRulesObject(arrayModel), 'value.length > 0', 'rules-array-required');
expectIn(sg.mockRecordValue(arrayModel, 'i'), 'namaBarang:', 'mock-array');
const form = vr.rowFormValues([subName, subQty, subFile], { namaBarang: 'Buku', qty: 3 });
expectEq(`${form.namaBarang}|${form.qty}|${form.nota}`, 'Buku|3|null', 'rowFormValues');
const rhf = vr.fieldRulesToRHF({ name: 'items', label: 'Items', type: 'formArrayField', rules: ['required'], source: 'none' });
if (typeof rhf.validate?.required !== 'function' || rhf.validate.required([]) === true) {
  fail++;
  console.log('MISS rhf-array-required');
}
const cfg = parser.normalizeConfig({
  parentName: null, moduleName: 'M', permissionKey: 'm', type: 'crud', features: {},
  fields: [{ name: 'items', label: 'Items', type: 'formArrayField', rules: [], source: 'none',
    subFields: [{ name: 'sub', label: 'Sub', type: 'formArrayField', rules: [], source: 'none' }] }],
});
expectEq((cfg.fields[0].subFields ?? []).length, 0, 'normalize-strips-nested');

// --- Fase E: i18n per-modul (Slice A) ---
const mg = jiti(`${ROOT}/src/modules/generator/engine/moduleGenerator.ts`);
const reg = jiti(`${ROOT}/src/modules/generator/engine/registration.ts`);
const probeConfig = {
  parentName: null,
  moduleName: 'I18n Probe',
  type: 'crud',
  permissionKey: 'i18nprobe',
  features: { list: true, detail: true, create: true, edit: true, delete: true, bulkUpload: true, export: true },
  fields: [
    { name: 'nama', label: 'Nama', type: 'textField', rules: ['required', 'min:3'], sortable: true, filterable: true, filterCriteria: 'contains', source: 'none' },
    { name: 'tipe', label: 'Tipe', type: 'selectField', rules: ['required'], sortable: false, filterable: true, filterCriteria: 'optionExact', source: 'mockStatic', options: [{ label: 'A', value: 'a' }] },
    {
      name: 'items', label: 'Items', type: 'formArrayField', rules: ['required'], sortable: false, filterable: false, filterCriteria: null, source: 'none',
      subFields: [{ name: 'barang', label: 'Barang', type: 'textField', rules: ['required'], source: 'none' }],
    },
  ],
};
const emitted = mg.generateModule(probeConfig);
const byPath = Object.fromEntries(emitted.map((f) => [f.path, f.content]));
const enPath = Object.keys(byPath).find((p) => p.endsWith('i18n/en.json'));
const idPath = Object.keys(byPath).find((p) => p.endsWith('i18n/id.json'));
expectEq(typeof enPath, 'string', 'emit-en');
expectEq(typeof idPath, 'string', 'emit-id');
const enJson = JSON.parse(byPath[enPath]);
expectEq(byPath[idPath], byPath[enPath], 'id-placeholders-en');
const mod = enJson.i18nprobe;
expectEq(typeof mod?.label, 'string', 'locale-label');
expectEq(typeof mod?.labelPlural, 'string', 'locale-labelPlural');
expectEq(typeof mod?.breadcrumbs?.create, 'string', 'locale-crumb');
expectEq(mod?.fields?.nama?.label, 'Nama', 'locale-field-label');
expectEq(typeof mod?.fields?.nama?.placeholder, 'string', 'locale-field-placeholder');
expectEq(mod?.fields?.items?.sub?.barang?.label, 'Barang', 'locale-sub-label');
expectEq(typeof mod?.fields?.items?.array?.editorTitle, 'string', 'locale-array-title');
expectEq(typeof mod?.toast?.created, 'string', 'locale-toast');
// Semua key t('<base>...') statis di file hasil generate harus ada di en.json.
const flat = {};
(function flatten(obj, pre = '') {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') flatten(v, `${pre}${k}.`);
    else flat[`${pre}${k}`] = v;
  }
})(enJson);
const code = emitted.filter((f) => /\.(ts|tsx)$/.test(f.path)).map((f) => f.content).join('\n');
const usedKeys = [...code.matchAll(/t\('(i18nprobe\.[A-Za-z0-9_.]+)'/g)].map((m) => m[1]);
expectEq(usedKeys.length > 0, true, 'module-keys-used');
for (const k of new Set(usedKeys)) {
  if (!(k in flat)) {
    fail++;
    console.log('MISS locale-key', k);
  }
}
// Literal Inggris lama di posisi UI harus hilang dari output.
for (const lit of [
  "header: 'Created By'",
  "header: 'Status'",
  "{ label: 'Status'",
  'is required.',
  'created successfully.',
  "not found'",
]) {
  if (code.includes(lit)) {
    fail++;
    console.log('MISS literal-leak', JSON.stringify(lit));
  }
}
// --- Fase F: label filter pakai key i18n + filterFields di dalam hook ---
// (regresi: filter region merender key mentah karena t() dievaluasi level-modul
// sebelum addModuleLocales terdaftar).
const fExact = F('kode', 'Kode', {});
fExact.filterCriteria = 'exact';
expectIn(fg.filterFieldSnippet(fExact, 'demo.fields.kode.label'), "label: t('demo.fields.kode.label')", 'filter-exact-label');
const fMin = F('harga', 'Harga', {});
fMin.filterCriteria = 'numberMin';
expectIn(fg.filterFieldSnippet(fMin, 'demo.fields.harga.label'), "label: `t('demo.fields.harga.label') (Min)`", 'filter-min-label');
const fDate = F('tgl', 'Tgl', {});
fDate.filterCriteria = 'dateRange';
const dateSnip = fg.filterFieldSnippet(fDate, 'demo.fields.tgl.label');
expectIn(dateSnip, "label: t('demo.fields.tgl.label')", 'filter-date-label');
expectIn(dateSnip, "rangeErrorMessage: t('validation.rangeRequired', { label: t('demo.fields.tgl.label') })", 'filter-date-errmsg');
const fOpt = F('tipe', 'Tipe', {});
fOpt.filterCriteria = 'optionExact';
expectIn(fg.filterFieldSnippet(fOpt, 'demo.fields.tipe.label'), "label: t('demo.fields.tipe.label')", 'filter-opt-label');
const hookFile = emitted.find((f) => f.path.endsWith('ListFilter.ts'));
expectEq(typeof hookFile?.content, 'string', 'emit-filter-hook');
if (hookFile) {
  const fnAt = hookFile.content.indexOf('export function');
  const ffAt = hookFile.content.indexOf('const filterFields');
  expectEq(fnAt !== -1 && ffAt !== -1 && fnAt < ffAt, true, 'filterfields-in-hook');
  expectIn(hookFile.content, "t('i18nprobe.fields.tipe.label')", 'filter-hook-opt-label');
}

// id.json = en ditimpa terjemahan step Translation (hanya key `<base>...`).
// Tabel hasil generate memakai RowActionButton; size/warna dari canvas ikut ter-bake.
const actionProbe = mg.generateModule({
  ...probeConfig,
  tableProps: { actionIconSize: 20, actionIconColor: { edit: 'danger' } },
});
const actionTable = actionProbe.find((f) => f.path.endsWith('Table.tsx')).content;
expectIn(actionTable, 'RowActionButton', 'table-row-action-btn');
expectIn(actionTable, 'iconSize={20}', 'table-action-size-baked');
expectIn(actionTable, 'color="danger"', 'table-action-color-baked');
const defaultProbe = mg.generateModule(probeConfig);
const defaultTable = defaultProbe.find((f) => f.path.endsWith('Table.tsx')).content;
expectIn(defaultTable, 'RowActionButton', 'table-row-action-default');
expectEq(defaultTable.includes('iconSize='), false, 'table-action-size-absent');
// --- Fase G: loader relasi wajib di-resolver (barrel api) ---
// (regresi: modul ber-relasi error `loadCategoryOptions is not defined`
// karena resolver hanya emit loader paging.)
const relProbe = mg.generateModule({
  ...probeConfig,
  permissionKey: 'relprobe',
  fields: [
    ...probeConfig.fields,
    { name: 'category', label: 'Category', type: 'selectField', rules: [], sortable: false, filterable: true, filterCriteria: 'optionExact', source: 'relation', relation: { definitionKey: 'catalogue/category', labelField: 'name', valueField: 'id' } },
  ],
});
const relResolver = relProbe.find((f) => f.path.endsWith('api/resolver.ts')).content;
expectIn(relResolver, 'export const loadCategoryOptions = USE_MOCK.categoryLoadOptions', 'relation-resolver-export');
expectIn(relResolver, 'loadCategoryOptions as mockLoadCategoryOptions', 'relation-resolver-alias');
const relMock = relProbe.find((f) => f.path.endsWith('api/mock.ts')).content;
expectIn(relMock, 'categoryLoadOptions: true,', 'relation-mock-flag');
const relHook = relProbe.find((f) => f.path.endsWith('ListFilter.ts')).content;
expectIn(relHook, "import { loadCategoryOptions } from '../api'", 'relation-hook-import');
const relForm = relProbe.find((f) => f.path.endsWith('Form.tsx')).content;
expectIn(relForm, "import { loadCategoryOptions } from '../api'", 'relation-form-import');
expectIn(relForm, 'loadOptions={loadCategoryOptions}', 'relation-form-loadoptions');
// --- Fase J: wording empty state kustom dari props tabel ---
const emptyProbe = mg.generateModule({
  ...probeConfig,
  tableProps: {
    emptyStateTitle: 'Belum ada "data"',
    filteredEmptyStateTitle: 'Tak cocok',
  },
});
const emptyPage = emptyProbe.find((f) => f.path.endsWith('ListPage.tsx')).content;
expectIn(emptyPage, 'emptyStateTitle="Belum ada \\"data\\""', 'empty-title-baked');
expectIn(emptyPage, 'emptyStateDescription={EMPTY_STATE.description}', 'empty-desc-fallback');
expectIn(emptyPage, 'filteredEmptyStateTitle="Tak cocok"', 'empty-filtered-baked');
const defaultPage = defaultProbe.find((f) => f.path.endsWith('ListPage.tsx')).content;
expectIn(defaultPage, 'emptyStateTitle={EMPTY_STATE.title}', 'empty-title-default');
// EMPTY_STATE di dalam komponen (regresi: key mentah `region.label` karena
// t() level-modul dievaluasi sebelum addModuleLocales).
const listPageFile = emitted.find((f) => f.path.endsWith('ListPage.tsx')).content;
expectEq(
  listPageFile.indexOf('function I18nProbeListPage()') < listPageFile.indexOf('const EMPTY_STATE'),
  true,
  'empty-state-in-component',
);
// --- Fase K: ikon ganda, mock kosong, path hapus ---
const mreg = jiti(`${ROOT}/vite-plugin/moduleRegistration.ts`);
const dblSrc = 'import { LayoutDashboard, Database } from "lucide-react";\nconst x = 1;\n';
expectEq(mreg.ensureLucideImport(dblSrc, 'Database'), dblSrc, 'lucide-no-dup-doublequote');
expectIn(
  mreg.ensureLucideImport('import { LayoutDashboard } from \'lucide-react\';\n', 'Database'),
  '{ LayoutDashboard, Database }',
  'lucide-add-missing',
);
expectEq(
  mreg.ensureLucideImport('import {\n  LayoutDashboard,\n  Users,\n} from "lucide-react";\n', 'Map'),
  'import { LayoutDashboard,\n  Users, Map } from "lucide-react";\n',
  'lucide-trailing-comma',
);
expectEq(
  mreg.pruneLucideImport('import { Users, MapPin } from "lucide-react";\nconst a = 1;\n', 'MapPin'),
  'import { Users } from "lucide-react";\nconst a = 1;\n',
  'lucide-prune-unused',
);
expectEq(
  mreg.pruneLucideImport('import { MapPin } from "lucide-react";\nconst a = <MapPin />;\n', 'MapPin'),
  'import { MapPin } from "lucide-react";\nconst a = <MapPin />;\n',
  'lucide-prune-keeps-used',
);
const mockFile = emitted.find((f) => f.path.endsWith('api/mock.ts')).content;
expectIn(mockFile, 'MockI18nProbeRecord[] = [];', 'mock-empty-records');
expectEq(mockFile.includes('Array.from'), false, 'mock-no-seed-array');
// --- Fase L: jalur wizard (definisi → config → generate) mempertahankan relasi ---
const fdWiz = jiti(`${ROOT}/src/modules/generator/engine/fromDefinition.ts`);
const wizDef = {
  key: 'master-data/product',
  parent: 'master-data',
  label: 'Products',
  singularLabel: 'Product',
  routeBase: 'master-data/products',
  apiPlural: 'products',
  permissionKey: 'product',
  moduleType: 'crud',
  features: { list: true, detail: true, create: true, edit: true, delete: true, bulkUpload: true, export: true },
  deleteMode: 'soft',
  status: 'published',
  fields: [
    { name: 'category', label: 'Category', type: 'selectField', rules: ['required'], source: 'relation', relation: { definitionKey: 'master-data/category', labelField: 'name', valueField: 'id' }, sortable: true, filterable: true, filterCriteria: 'optionExact' },
    { name: 'name', label: 'Name', type: 'textField', rules: [], source: 'none', sortable: true, filterable: true, filterCriteria: 'contains' },
  ],
  layout: { form: [], table: { order: [], hidden: [] } },
};
const wizConfig = fdWiz.definitionToConfig(wizDef);
expectEq(JSON.stringify(wizConfig.fields.map((f) => f.source)), JSON.stringify(['relation', 'none']), 'wizard-keeps-relation');
const wizOut = mg.generateModule(wizConfig);
const wizMock = wizOut.find((f) => f.path.endsWith('api/mock.ts')).content;
expectIn(wizMock, 'export async function loadCategoryOptions', 'wizard-relation-loader');
expectIn(wizMock, "from '../../category/api/mock'", 'wizard-relation-import');
for (const f of wizOut) {
  const stripped = f.content.replace(/loadCategoryOptions|CategoryOption|categoryLoadOptions|mockLoadCategoryOptions|useCategoryOptionsQuery|getCategoryOptions|CategoryOptions/g, '');
  expectEq(/categoryOptions/.test(stripped), false, `wizard-no-dangle:${f.path.split('/').pop()}`);
}
const delApi = jiti(`${ROOT}/src/modules/generator/api/deleteFromRepo.ts`);
const regForDelete = reg.buildRegistration(probeConfig);
expectEq(
  delApi.moduleDirForRegistration(regForDelete),
  'src/modules/i18n-probe',
  'delete-module-dir',
);
const translatedConfig = {
  ...probeConfig,
  i18n: { id: { 'i18nprobe.fields.nama.label': 'Nama (ID)', 'field.nama.label': 'SKIP', 'other.x': 'SKIP' } },
};
const translatedFiles = mg.generateModule(translatedConfig);
const translatedByPath = Object.fromEntries(translatedFiles.map((f) => [f.path, f.content]));
const idPath2 = Object.keys(translatedByPath).find((p) => p.endsWith('i18n/id.json'));
const idJson2 = JSON.parse(translatedByPath[idPath2]);
expectEq(idJson2.i18nprobe.fields.nama.label, 'Nama (ID)', 'id-merge');
expectEq(idJson2.i18nprobe.fields.nama.placeholder, enJson.i18nprobe.fields.nama.placeholder, 'id-fallback');
expectEq('field' in idJson2 || 'other' in idJson2, false, 'id-base-filter');
// definitionToConfig meneruskan i18n (sumber id.json saat Generate to repo).
const defs = jiti(`${ROOT}/src/modules/generator/definitions/normalize.ts`);
const { definitionToConfig } = jiti(`${ROOT}/src/modules/generator/engine/fromDefinition.ts`);
const savedDef = defs.configToDefinition(translatedConfig, { status: 'draft' });
const roundConfig = definitionToConfig(savedDef);
expectEq(roundConfig.i18n?.id?.['i18nprobe.fields.nama.label'], 'Nama (ID)', 'i18n-roundtrip');

// Registrasi: breadcrumb + nav memakai labelKey modul (fallback label tetap ada).
const regOut = reg.buildRegistration(probeConfig);
const regCode = regOut.routes.map((r) => r.code).join('\n') + '\n' + regOut.navItemCode;
expectIn(regCode, "labelKey: 'i18nprobe.breadcrumbs.list'", 'reg-crumb-list');
expectIn(regCode, "labelKey: 'i18nprobe.breadcrumbs.create'", 'reg-crumb-create');
expectIn(regCode, "labelKey: 'i18nprobe.labelPlural'", 'reg-nav');
// Grup parent: label + labelKey parentLabel (satu key per modul anak).
const parentConfig = { ...probeConfig, parentName: 'Master Data', permissionKey: 'childmod' };
const parentLocales = mg.generateModule(parentConfig);
const parentEn = JSON.parse(
  parentLocales.find((f) => f.path.endsWith('i18n/en.json')).content,
);
expectEq(parentEn.childmod.parentLabel, 'Master Data', 'locale-parent');
const parentReg = reg.buildRegistration(parentConfig);
expectIn(parentReg.navSnippet, "labelKey: 'childmod.parentLabel'", 'reg-parent-key');
expectIn(parentReg.navSnippet, "label: 'Master Data'", 'reg-parent-fallback');
// Tanpa parent: tidak ada key parentLabel.
expectEq('parentLabel' in enJson.i18nprobe, false, 'locale-no-parent');
// Ikon nav: nama lucide dari config dipakai di snippet; default Database.
const iconConfig = { ...probeConfig, menuIcon: { name: 'Users' } };
const iconReg = reg.buildRegistration(iconConfig);
expectEq(iconReg.iconName, 'Users', 'reg-icon-name');
expectIn(iconReg.navItemCode, '<Users className="h-5 w-5" />', 'reg-icon-code');
const noIconReg = reg.buildRegistration(probeConfig);
expectEq(noIconReg.iconName, 'Database', 'reg-icon-default');
// Registrasi nav (vite-plugin): validasi keberadaan ikon + kelola import lucide.
const mr = jiti(`${ROOT}/vite-plugin/moduleRegistration.ts`);
expectEq(mr.resolveNavIconName('Users'), 'Users', 'icon-known');
expectEq(mr.resolveNavIconName('NotAnIcon'), 'Database', 'icon-unknown');
expectEq(mr.resolveNavIconName('x;evil()'), 'Database', 'icon-evil');
const navSrc = "import { Database } from 'lucide-react';\nconst x = 1;\n";
expectIn(mr.ensureLucideImport(navSrc, 'Database'), "import { Database } from 'lucide-react';", 'icon-import-kept');
expectIn(mr.ensureLucideImport(navSrc, 'Users'), "import { Database, Users } from 'lucide-react';", 'icon-import-added');
// Publish ulang dgn ikon beda: item flat terupdate, bukan duplikat.
const flatBase = `${navSrc}const items = [
  {
    label: 'Probe',
    path: '/probes',
    icon: <Database className="h-5 w-5" />,
  },
];
// __GENERATOR_NAV_ITEMS__
`;
const flatReg = { ...iconReg, navPath: '/probes', routes: iconReg.routes };
const flatOut = mr.registerModuleNav(flatBase, flatReg);
expectIn(flatOut.source, '<Users className="h-5 w-5" />', 'icon-resync-flat');
expectEq(flatOut.added, false, 'icon-resync-no-dup');
const flatSame = mr.registerModuleNav(flatOut.source, flatReg);
expectEq(flatSame.source, flatOut.source, 'icon-resync-idempotent');
// Item anak: ikon group parent ikut terupdate.
const parentBase = `${navSrc}const items = [
  // __GENERATOR_PARENT master-data__
  {
    label: 'Master',
    icon: <Database className="h-5 w-5" />,
    children: [
      { label: 'Probe', path: '/probes', permissionKey: 'probe.view' },
    ],
  },
];
// __GENERATOR_NAV_ITEMS__
`;
const parentOut = mr.registerModuleNav(parentBase, { ...flatReg, parentPath: 'master-data' });
expectIn(parentOut.source, '<Users className="h-5 w-5" />', 'icon-resync-parent');
// Unregister: hapus routes + import + item nav, idempoten.
const fakeReg = {
  moduleImportPath: '../modules/probe',
  routes: [{ path: 'probes', code: '' }],
  navPath: '/probes',
  parentPath: '',
};
const routerSrc = `import {
  ProbeListPage,
} from '../modules/probe';
// __GENERATOR_IMPORTS__
const r = [
      {
        path: 'probes',
        element: <ProbeListPage />,
        handle: {
          breadcrumb: [{ label: 'Probes', labelKey: 'probe.breadcrumbs.list' }],
          requiredPermission: 'probe.view',
        },
      },
];`;
const unRoutes = mr.unregisterModuleRoutes(routerSrc, fakeReg);
expectEq(unRoutes.removed, 1, 'unreg-route-count');
expectEq(unRoutes.source.includes("path: 'probes'"), false, 'unreg-route-gone');
expectEq(unRoutes.source.includes('../modules/probe'), false, 'unreg-import-gone');
expectEq(unRoutes.source.includes('// __GENERATOR_IMPORTS__'), true, 'unreg-anchor-kept');
const unRoutesAgain = mr.unregisterModuleRoutes(unRoutes.source, fakeReg);
expectEq(unRoutesAgain.removed, 0, 'unreg-route-idempotent');
expectEq(unRoutesAgain.source, unRoutes.source, 'unreg-route-stable');
const navFlatDel = `${navSrc}const items = [
  {
    label: 'Probe',
    labelKey: 'probe.labelPlural',
    path: '/probes',
    icon: <Database className="h-5 w-5" />,
    permissionKey: 'probe.view',
  },
];
// __GENERATOR_NAV_ITEMS__
`;
const unNav = mr.unregisterModuleNav(navFlatDel, fakeReg);
expectEq(unNav.removed, 1, 'unreg-nav-count');
expectEq(unNav.source.includes("path: '/probes'"), false, 'unreg-nav-gone');
expectEq(unNav.source.includes('// __GENERATOR_NAV_ITEMS__'), true, 'unreg-nav-anchor-kept');
// Anak terakhir grup: grup + marker ikut terhapus; sibling tersisa dipertahankan.
const navGroupDel = `${navSrc}const items = [
  // __GENERATOR_PARENT master-data__
  {
    label: 'Master',
    labelKey: 'childmod.parentLabel',
    icon: <Database className="h-5 w-5" />,
    children: [
      { label: 'Probe', labelKey: 'probe.labelPlural', path: '/probes', permissionKey: 'probe.view' },
    ],
  },
];
// __GENERATOR_NAV_ITEMS__
`;
const unGroup = mr.unregisterModuleNav(navGroupDel, { ...fakeReg, parentPath: 'master-data' });
expectEq(unGroup.removed, 1, 'unreg-group-child');
expectEq(unGroup.source.includes('__GENERATOR_PARENT master-data__'), false, 'unreg-group-gone');
const navSiblingDel = `${navSrc}const items = [
  // __GENERATOR_PARENT master-data__
  {
    label: 'Master',
    labelKey: 'childmod.parentLabel',
    icon: <Database className="h-5 w-5" />,
    children: [
      { label: 'Probe', labelKey: 'probe.labelPlural', path: '/probes', permissionKey: 'probe.view' },
      { label: 'Other', labelKey: 'other.labelPlural', path: '/others', permissionKey: 'other.view' },
    ],
  },
];
// __GENERATOR_NAV_ITEMS__
`;
const unSibling = mr.unregisterModuleNav(navSiblingDel, { ...fakeReg, parentPath: 'master-data' });
expectEq(unSibling.removed, 1, 'unreg-sibling-child');
expectEq(unSibling.source.includes('__GENERATOR_PARENT master-data__'), true, 'unreg-group-kept');
expectIn(unSibling.source, "path: '/others'", 'unreg-sibling-kept');
// Validasi target hapus: dalam src/modules boleh, escape/luar ditolak.
const mw = jiti(`${ROOT}/vite-plugin/moduleWriter.ts`);
expectEq(mw.resolveDeleteTarget('/a/b', 'src/modules/probe'), '/a/b/src/modules/probe', 'del-target-ok');
for (const [bad, tag] of [['../escape', 'del-escape'], ['src/modules', 'del-root'], ['', 'del-empty']]) {
  try {
    mw.resolveDeleteTarget('/a/b', bad);
    fail++;
    console.log('MISS', tag, 'tidak melempar');
  } catch {
    /* diharapkan */
  }
}

// definitionToConfig mempertahankan menuIcon Step 1 (regresi ikon menu jadi Database).
const fd = jiti(`${ROOT}/src/modules/generator/engine/fromDefinition.ts`);
const iconDef = {
  key: 'region',
  label: 'Regions',
  singularLabel: 'Region',
  parent: null,
  moduleType: 'crud',
  permissionKey: 'region',
  features: {},
  menuIcon: { name: 'Users' },
  fields: [],
  layout: { table: { order: [], hidden: [] } },
};
const iconCfg = fd.definitionToConfig(iconDef);
expectEq(iconCfg.menuIcon?.name, 'Users', 'fromdef-menuicon');
// definitionToConfig mempertahankan layout form kanvas (regresi section/grid hilang saat publish ulang).
const layoutDef = {
  ...iconDef,
  layout: {
    form: [
      { field: 'section-1', order: 0, colSpan: 12, kind: 'section', label: 'Data' },
      { field: 'nama', order: 1, colSpan: 6 },
    ],
    table: { order: [], hidden: [] },
  },
};
const layoutCfg = fd.definitionToConfig(layoutDef);
expectEq(layoutCfg.formLayout?.length, 2, 'fromdef-formlayout-len');
expectEq(layoutCfg.formLayout?.[0]?.kind, 'section', 'fromdef-formlayout-section');
expectEq(layoutCfg.formLayout?.[1]?.colSpan, 6, 'fromdef-formlayout-span');
const rg = jiti(`${ROOT}/src/modules/generator/engine/registration.ts`);
const menuReg = rg.buildRegistration(iconCfg);
expectEq(menuReg.iconName, 'Users', 'registration-iconname');
expectIn(menuReg.navItemCode ?? menuReg.navSnippet ?? '', '<Users', 'registration-nav-icon');
// setTableProps: patch size/warna ikon aksi kanvas tersimpan (regresi dropdown kartu Ikon aksi).
const ops = jiti(`${ROOT}/src/modules/generator/runtime/layoutOps.ts`);
const baseLayout = { form: [], table: { order: [], hidden: [], props: { dense: true } } };
const sized = ops.setTableProps(baseLayout, { actionIconSize: 20 });
expectEq(sized.table.props.actionIconSize, 20, 'props-icon-size');
expectEq(sized.table.props.dense, true, 'props-icon-size-merge');
const colored = ops.setTableProps(sized, { actionIconColor: { edit: 'danger', view: 'bogus' } });
expectEq(JSON.stringify(colored.table.props.actionIconColor), JSON.stringify({ edit: 'danger' }), 'props-icon-color');
expectEq(colored.table.props.actionIconSize, 20, 'props-icon-color-keep-size');
const badSize = ops.setTableProps(colored, { actionIconSize: 99 });
expectEq('actionIconSize' in badSize.table.props, false, 'props-icon-size-invalid');
const badColor = ops.setTableProps(colored, { actionIconColor: { edit: 'bogus' } });
expectEq('actionIconColor' in badColor.table.props, false, 'props-icon-color-invalid');
const boolPatch = ops.setTableProps(baseLayout, { dense: false });
expectEq(boolPatch.table.props.dense, false, 'props-bool-still-works');
// Draft milik modul terhapus dikenali dari info-nya (cermin configToDefinition).
const dt = jiti(`${ROOT}/src/modules/generator/builder/draft.ts`);
const rootInfo = { parentName: '', newParentName: '', moduleName: 'Region', type: 'crud', permissionKey: 'region' };
expectEq(dt.draftDefinitionKey(rootInfo), 'region', 'draft-key-root');
const childInfo = { ...rootInfo, parentName: 'master-data', moduleName: 'Company' };
expectEq(dt.draftDefinitionKey(childInfo), 'master-data/company', 'draft-key-child');
const newParentInfo = { ...rootInfo, parentName: '__new__', newParentName: 'Master Data', moduleName: 'Company' };
expectEq(dt.draftDefinitionKey(newParentInfo), 'master-data/company', 'draft-key-new-parent');
const stub = (info) => ({ info, features: {}, fields: [], layout: null, deleteMode: 'soft', menuIcon: null, sampleRows: [], step: 0, updatedAt: '' });
expectEq(dt.isDraftOfModule(stub(childInfo), { key: 'master-data/company' }), true, 'draft-match');
expectEq(dt.isDraftOfModule(stub(childInfo), { key: 'master-data/other' }), false, 'draft-mismatch');
expectEq(dt.isDraftOfModule(stub({ ...childInfo, moduleName: '' }), { key: 'master-data/company' }), false, 'draft-empty-name');
expectEq(dt.isDraftOfModule(null, { key: 'region' }), false, 'draft-null');
// Aturan validasi: arg kosong/angka-tak-valid/regex-rusak ditolak publish; runtime tak crash.
const ruleField = (rules) => ({
  name: 'nama',
  label: 'Nama',
  type: 'textField',
  source: 'none',
  rules,
});
const ruleBase = {
  moduleName: 'Probe',
  parentName: null,
  type: 'crud',
  permissionKey: 'probe',
  features: {
    list: true,
    detail: false,
    create: false,
    edit: false,
    delete: false,
    bulkUpload: false,
    export: false,
  },
  fields: [],
};
function ruleIssues(rules) {
  return parser
    .validateConfig({ ...ruleBase, fields: [ruleField(rules)] })
    .filter((i) => i.path === 'fields[0].rules');
}
expectEq(ruleIssues(['min:']).length, 1, 'rule-arg-required');
expectEq(ruleIssues(['max:abc']).length, 1, 'rule-numeric');
expectEq(ruleIssues(['regex:(']).length, 1, 'rule-regex');
expectEq(ruleIssues(['min:3', 'max:10', 'regex:^\\d+$', 'required']).length, 0, 'rule-valid');
let rxThrew = false;
let rxRules = {};
try {
  rxRules = vr.fieldRulesToRHF({ name: 'kode', label: 'Kode', type: 'textField', rules: ['regex:('] });
} catch {
  rxThrew = true;
}
expectEq(rxThrew, false, 'runtime-regex-no-throw');
expectEq('pattern' in rxRules, false, 'runtime-regex-skipped');
const emptyMin = vr.fieldRulesToRHF({ name: 'nama', label: 'Nama', type: 'textField', rules: ['min:'] });
expectEq('minLength' in emptyMin, false, 'runtime-min-empty-skipped');
const okMin = vr.fieldRulesToRHF({ name: 'nama', label: 'Nama', type: 'textField', rules: ['min:3'] });
expectEq(okMin.minLength?.value, 3, 'runtime-min-kept');
// Kolom sistem: bisa dipindah (drag) + diatur lebar via canvas.
const sysLayout = { form: [], table: { order: ['nama', 'status'], hidden: [], props: {} } };
const movedSys = ops.moveTableColumn(sysLayout, 'status', 'nama');
expectEq(JSON.stringify(movedSys.table.order), JSON.stringify(['status', 'nama']), 'props-system-move');
const sysWidth = ops.setTableWidth(sysLayout, 'created_date', 200);
expectEq(sysWidth.table.widths.created_date, 200, 'props-system-width');
// Normalize mempertahankan posisi kolom sistem hasil drag (regresi seret kolom sistem).
const nl = jiti(`${ROOT}/src/modules/generator/definitions/normalize.ts`);
const normedSys = nl.normalizeLayout(
  { form: [], table: { order: ['status', 'nama'], hidden: [], props: {} } },
  ['nama'],
);
expectEq(JSON.stringify(normedSys.table.order), JSON.stringify(['status', 'nama', 'created_by', 'created_date']), 'normalize-keeps-system-order');
const normedMissing = nl.normalizeLayout(
  { form: [], table: { order: ['nama'], hidden: [], props: {} } },
  ['nama'],
);
expectEq(
  JSON.stringify(normedMissing.table.order),
  JSON.stringify(['nama', 'created_by', 'created_date', 'status']),
  'normalize-appends-system',
);
// Field baru default di kanan mengikuti urutan form kanvas (append, bukan kiri).
const normedFresh = nl.normalizeLayout(
  { form: [], table: { order: ['a'], hidden: [], props: {} } },
  ['a', 'b'],
);
expectEq(
  JSON.stringify(normedFresh.table.order),
  JSON.stringify(['a', 'b', 'created_by', 'created_date', 'status']),
  'normalize-fresh-right',
);
// Detail: posisi baris sistem hasil drag dipertahankan + bisa dipindah.
const normedDetail = nl.normalizeLayout(
  { form: [], table: { order: ['nama'], hidden: [] }, detail: { order: ['created_date', 'nama'], hidden: [] } },
  ['nama'],
);
expectEq(JSON.stringify(normedDetail.detail.order), JSON.stringify(['created_date', 'nama']), 'normalize-keeps-system-detail');
const movedDetail = ops.moveDetailItem(
  { form: [], table: { order: [], hidden: [] }, detail: { order: ['status', 'nama'], hidden: [] } },
  'nama',
  'status',
);
expectEq(JSON.stringify(movedDetail.detail.order), JSON.stringify(['nama', 'status']), 'props-system-detail-move');

// --- Fase H: rule validasi mengikuti tipe field ---
const vr2 = jiti(`${ROOT}/src/modules/generator/registry/validationRules.ts`);
const numRules = vr2.rulesForFieldType('numberField');
expectEq(numRules.includes('min') && numRules.includes('max'), true, 'rules-number-minmax');
expectEq(numRules.includes('minLength') || numRules.includes('maxLength'), false, 'rules-number-no-length');
const textRules = vr2.rulesForFieldType('textField');
expectEq(textRules.includes('minLength') && textRules.includes('email') && textRules.includes('regex'), true, 'rules-text-length-email');
expectEq(textRules.includes('min') || textRules.includes('max'), false, 'rules-text-no-minmax');
expectEq(
  JSON.stringify(vr2.pruneRulesForType(['required', 'minLength:3', 'min:1'], 'numberField')),
  JSON.stringify(['required', 'min:1']),
  'rules-prune-number',
);

// --- Fase I: default layout vertikal saat span sempit (<=6) ---
expectEq(cp.resolveFormItemLayout(undefined, 6), 'vertical', 'layout-narrow');
expectEq(cp.resolveFormItemLayout(undefined, 7), 'horizontal', 'layout-wide');
expectEq(cp.resolveFormItemLayout(undefined, undefined), 'horizontal', 'layout-no-span');
expectEq(cp.resolveFormItemLayout('horizontal', 6), 'horizontal', 'layout-explicit-wins');
const narrowSnip = fg.formItemSnippet(ctx, F('nama', 'Nama', { type: 'textField' }), { span: 6 });
expectIn(narrowSnip, 'layout="vertical"', 'snippet-narrow-vertical');
const wideSnip = fg.formItemSnippet(ctx, F('nama', 'Nama', { type: 'textField' }), { span: 12 });
expectIn(wideSnip, 'layout="horizontal"', 'snippet-wide-horizontal');

console.log(fail === 0 ? 'EMISSION PASS' : `EMISSION FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
