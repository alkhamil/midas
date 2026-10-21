// Layar sebelum editor: login (akun dibuat administrator, tidak ada pendaftaran) dan import file lama dari IndexedDB.
import { useState } from 'react';
import { auth, importLegacyDocument } from '../storage.js';
import { listLegacyFiles, markLegacyImported, projectStorage as legacyProjects } from '../legacyStorage.js';

const Logo = () => (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#0058CA" /><path d="M8 30V10h6.5L20 21.5 25.5 10H32v20h-5.5V17.5L21.5 28h-3L13.5 17.5V30Z" fill="white" /></svg>
);

export function AuthScreen({ onSignedIn, overlay = false }) {
    const [form, setForm] = useState({ email: '', password: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            onSignedIn(await auth.login(form.email, form.password));
        } catch (err) {
            setError(err instanceof TypeError ? 'Cannot reach the Midas server.' : err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={'gate' + (overlay ? ' gate-overlay' : '')}>
            <form className="gate-card" onSubmit={submit}>
                <Logo />
                <h1>{overlay ? 'Session expired' : 'Sign in to Midas'}</h1>
                <p className="gate-sub">{overlay ? 'Sign in again to keep saving. Your open file stays as it is.' : 'Ask an administrator if you do not have an account yet.'}</p>
                <label className="gate-field"><span>Email</span><input type="email" value={form.email} onChange={set('email')} autoComplete="email" required autoFocus /></label>
                <label className="gate-field"><span>Password</span><input type="password" value={form.password} onChange={set('password')} autoComplete="current-password" required /></label>
                {error && <p className="gate-error" role="alert">{error}</p>}
                <button className="gate-primary" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
            </form>
        </div>
    );
}

export function LegacyImport({ files, onDone }) {
    const [progress, setProgress] = useState(null);
    const [failed, setFailed] = useState([]);

    async function run() {
        const errors = [];
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            setProgress({ index: i + 1, name: f.name });
            try {
                const data = await legacyProjects.loadProject(f.id);
                if (data) await importLegacyDocument(f.id, { ...data, name: data.name || f.name });
                markLegacyImported(f.id);
            } catch (e) {
                console.error('Import failed', f, e);
                errors.push(`${f.name}: ${e.message}`);
            }
        }
        setProgress(null);
        if (errors.length) setFailed(errors);
        else onDone();
    }

    return (
        <div className="gate">
            <div className="gate-card">
                <Logo />
                <h1>{files.length} local file{files.length === 1 ? '' : 's'} found</h1>
                <p className="gate-sub">These files are still stored only in this browser. Import them to your workspace so they are saved on the server.</p>
                <ul className="gate-list">
                    {files.slice(0, 6).map(f => <li key={f.id}>{f.name}</li>)}
                    {files.length > 6 && <li className="muted">and {files.length - 6} more…</li>}
                </ul>
                {progress && <p className="gate-sub">Importing {progress.index}/{files.length}: {progress.name}…</p>}
                {failed.length > 0 && <p className="gate-error" role="alert">Some files could not be imported:<br />{failed.join(' · ')}</p>}
                <button className="gate-primary" disabled={!!progress} onClick={run}>{failed.length ? 'Try again' : 'Import to workspace'}</button>
                <button type="button" className="gate-link" disabled={!!progress} onClick={onDone}>Skip for now</button>
            </div>
        </div>
    );
}

export { listLegacyFiles };
