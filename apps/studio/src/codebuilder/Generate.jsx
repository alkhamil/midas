// Dialog "Generate kode": cara developer mengambil source code hasil Code Builder.
//  1. CLI (disarankan): `npx @midas/cli generate "<project>" --out .` di repo aplikasi — bisa diulang kapan pun.
//  2. Unduh .zip dari Studio.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { assembleProject, buildTrees, generateProject, zipFiles } from '@midas/builder-core';
import { libraryApi, templateApi } from '../storage.js';

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
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState(null);
    const save = (bytes, name) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const slug = project.name.replace(/[^\w-]+/g, '-').toLowerCase();
    /** Complete project: base project + generated code + the library package → `npm install && npm run dev`. */
    const downloadProject = async () => {
        setBusy(true);
        setProblem(null);
        try {
            const lib = project.library;
            const [template, pkg] = await Promise.all([templateApi.get('base-project'), lib ? libraryApi.package(lib.id, lib.version) : null]);
            if (!pkg) throw new Error(`The package of ${lib ? `${lib.packageName}@${lib.version}` : 'the library'} has not been uploaded yet. Run \`midas bundle\` in the package repo, then try again.`);
            const files = assembleProject(template, result.files, { appName: project.name, libraryName: lib.packageName, tarballName: pkg.name, tarball: pkg.bytes });
            save(zipFiles(files, slug), `${slug}.zip`);
        }
        catch (e) {
            setProblem(e.message);
        }
        setBusy(false);
    };
    const downloadSources = () => save(zipFiles(result.files), `${slug}-generated.zip`);
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
                    <h4>Download the project (easiest)</h4>
                    <p className="small-label">A complete app: the base project + your generated modules + the UI library (<code>{project.library?.packageName}</code>) bundled in <code>vendor/</code>. Unzip it, then:</p>
                    <div className="cb-code"><code>npm install &amp;&amp; npm run dev</code></div>
                    <button type="button" className="wide-button primary" disabled={!names.length || busy} onClick={downloadProject}>{busy ? 'Preparing…' : 'Download project (.zip)'}</button>
                    {problem && <p className="cb-error">{problem}</p>}
                    <h4>Update an existing app</h4>
                    <p className="small-label">In the app's folder (already signed in with <code>midas login</code>). Safe to repeat: only generated files are overwritten; hand-written code is never touched.</p>
                    <div className="cb-code"><code>{cmd}</code><button type="button" className="cb-link" onClick={() => navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>{copied ? 'Copied' : 'Copy'}</button></div>
                    <button type="button" className="cb-link" disabled={!names.length} onClick={downloadSources}>Or download only the generated files ({names.length} files)</button>
                    <h4>What gets generated</h4>
                    {groups.length ? <ul className="cb-files">{groups.map(([k, n]) => <li key={k}><code>{k}</code><span>{n} files</span></li>)}</ul> : <p className="small-label">Nothing to generate yet — register screens in a module and complete its entity fields.</p>}
                    {result.warnings.map((w, i) => <p key={i} className="cb-warn">⚠ {w}</p>)}
                    <p className="small-label">Data is still mocked (<code>USE_MOCK</code> in <code>api/mock.ts</code>) until the backend endpoints are connected.</p>
                </div>
            </div>
        </div>,
        document.body,
    );
}
