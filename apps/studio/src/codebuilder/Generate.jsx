// Dialog "Generate kode": cara developer mengambil source code hasil Code Builder.
//  1. CLI (disarankan): `npx @midas/cli generate "<project>" --out .` di repo aplikasi — bisa diulang kapan pun.
//  2. Unduh .zip dari Studio.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildTrees, generateProject, zipFiles } from '@midas/builder-core';

export function GenerateDialog({ project, ctx, onClose }) {
    const result = useMemo(() => {
        try {
            return generateProject(project, buildTrees(project.config, ctx));
        }
        catch (e) {
            return { error: e.message, files: {}, warnings: [] };
        }
    }, [project, ctx]);
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        const on = e => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, [onClose]);
    const names = Object.keys(result.files);
    const cmd = `npx @midas/cli generate "${project.name}" --out .`;
    const download = () => {
        const bytes = zipFiles(result.files);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
        a.download = `${project.name.replace(/[^\w-]+/g, '-').toLowerCase()}-generated.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const groups = useMemo(() => {
        const g = new Map();
        for (const n of names) {
            const key = n.startsWith('src/modules/') ? n.split('/').slice(0, 3).join('/') : 'src/app/generated';
            g.set(key, (g.get(key) || 0) + 1);
        }
        return [...g];
    }, [names.join('|')]);
    // Di-portal ke body: panel kiri & workspace punya stacking context sendiri, jadi dialog bisa tertutup/bertumpuk tanpa ini.
    return createPortal(
        <div className="cb-modal-backdrop" onClick={onClose}>
            <div className="cb-modal" role="dialog" aria-label="Generate kode" onClick={e => e.stopPropagation()}>
                <header><b>Generate kode — {project.name}</b><button type="button" className="icon-button small" aria-label="Tutup" onClick={onClose}>×</button></header>
                {result.error && <p className="cb-error">{result.error}</p>}
                <div className="cb-modal-body">
                    <h4>Cara 1 · Ambil lewat CLI (disarankan)</h4>
                    <p className="small-label">Jalankan di folder repo aplikasi (hasil <code>git clone</code> base project, sudah <code>midas login</code>). Aman diulang: hanya file hasil generate yang ditimpa, kode tulisan tangan tidak disentuh.</p>
                    <div className="cb-code"><code>{cmd}</code><button type="button" className="cb-link" onClick={() => navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>{copied ? 'Tersalin' : 'Salin'}</button></div>
                    <h4>Cara 2 · Unduh .zip</h4>
                    <p className="small-label">Berisi folder <code>src/</code> hasil generate; gabungkan ke repo aplikasi.</p>
                    <button type="button" className="wide-button primary" disabled={!names.length} onClick={download}>Unduh .zip ({names.length} file)</button>
                    <h4>Yang dibangkitkan</h4>
                    {groups.length ? <ul className="cb-files">{groups.map(([k, n]) => <li key={k}><code>{k}</code><span>{n} file</span></li>)}</ul> : <p className="small-label">Belum ada yang bisa dibangkitkan — daftarkan screen ke module dan lengkapi field entity.</p>}
                    {result.warnings.map((w, i) => <p key={i} className="cb-warn">⚠ {w}</p>)}
                    <p className="small-label">Setelah itu: <code>npm install && npm run dev</code>. Data masih mock (<code>USE_MOCK</code> di <code>api/mock.ts</code>) sampai endpoint backend dihubungkan.</p>
                </div>
            </div>
        </div>,
        document.body,
    );
}
