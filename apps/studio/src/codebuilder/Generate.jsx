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
            <div className="cb-modal" role="dialog" aria-label="Generate code" onClick={e => e.stopPropagation()}>
                <header><b>Generate code — {project.name}</b><button type="button" className="icon-button small" aria-label="Close" onClick={onClose}>×</button></header>
                {result.error && <p className="cb-error">{result.error}</p>}
                <div className="cb-modal-body">
                    <h4>Option 1 · Pull with the CLI (recommended)</h4>
                    <p className="small-label">Run in your app repo folder (a <code>git clone</code> of the base project, already signed in with <code>midas login</code>). Safe to repeat: only generated files are overwritten; hand-written code is never touched.</p>
                    <div className="cb-code"><code>{cmd}</code><button type="button" className="cb-link" onClick={() => navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>{copied ? 'Copied' : 'Copy'}</button></div>
                    <h4>Option 2 · Download .zip</h4>
                    <p className="small-label">Contains the generated <code>src/</code> folder; merge it into your app repo.</p>
                    <button type="button" className="wide-button primary" disabled={!names.length} onClick={download}>Download .zip ({names.length} files)</button>
                    <h4>What gets generated</h4>
                    {groups.length ? <ul className="cb-files">{groups.map(([k, n]) => <li key={k}><code>{k}</code><span>{n} files</span></li>)}</ul> : <p className="small-label">Nothing to generate yet — register screens in a module and complete its entity fields.</p>}
                    {result.warnings.map((w, i) => <p key={i} className="cb-warn">⚠ {w}</p>)}
                    <p className="small-label">Then run <code>npm install && npm run dev</code>. Data is still mocked (<code>USE_MOCK</code> in <code>api/mock.ts</code>) until the backend endpoints are connected.</p>
                </div>
            </div>
        </div>,
        document.body,
    );
}
