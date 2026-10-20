import { useEffect, useState } from 'react';
import { Topbar, LeftRail, LeftPanel, CanvasArea, RightPanel, Overlays } from './components/Shell.jsx';
import { AuthScreen, LegacyImport, listLegacyFiles } from './components/Gate.jsx';
import { auth, migrateLegacyLibraries } from './storage.js';
import { boot } from './boot.js';
import { kv as legacyKv } from './legacyStorage.js';

let started = null;
function startEngine() {
    started ??= import('./engine/midas.js');
    return started;
}

// Shown while the engine starts (the editor module, fonts, the renderer and the last file); fades out when it is ready.
function Splash({ done }) {
    const [gone, setGone] = useState(false);
    const [p, setP] = useState(() => boot.get());
    useEffect(() => boot.subscribe((pct, label) => setP({ pct, label })), []);
    useEffect(() => {
        if (!done) return;
        const t = setTimeout(() => setGone(true), 400);
        return () => clearTimeout(t);
    }, [done]);
    if (gone) return null;
    return (
        <div className={'splash' + (done ? ' out' : '')} role="progressbar" aria-label="Starting Midas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done ? 100 : p.pct)} aria-valuetext={p.label}>
            <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 28V6h6.5L16 17.5 21.5 6H28v22h-5.5V15.5L18 26h-4l-4.5-10.5V28Z" fill="currentColor" /></svg>
            <div className="splash-bar"><i style={{ width: (done ? 100 : p.pct) + '%' }}></i></div>
            <span className="splash-pct">{Math.round(done ? 100 : p.pct)}%</span>
        </div>
    );
}

export default function App() {
    // checking → (auth) → (import) → ready. Editor (engine) hanya dimulai saat ready.
    const [phase, setPhase] = useState('checking');
    const [user, setUser] = useState(null);
    const [legacy, setLegacy] = useState([]);
    const [expired, setExpired] = useState(false);
    const [error, setError] = useState(null);
    const [engineReady, setEngineReady] = useState(false);

    async function afterSignIn(u) {
        setUser(u);
        const files = await listLegacyFiles().catch(() => []);
        setLegacy(files);
        setPhase(files.length ? 'import' : 'ready');
    }

    function check() {
        setError(null);
        auth.me().then(u => (u ? afterSignIn(u) : setPhase('auth'))).catch(() => setError('Cannot reach the Midas server. Make sure it is running, then try again.'));
    }

    useEffect(check, []);
    useEffect(() => {
        if (phase !== 'ready') return;
        boot.set(10, 'Starting');
        // Library dari penyimpanan lama dipindahkan dulu, supaya panel Assets langsung membaca dari server.
        migrateLegacyLibraries(legacyKv).catch(e => console.warn('Legacy library migration skipped:', e))
            .then(startEngine).then(() => setEngineReady(true)).catch(e => { console.error(e); setError(e.message); });
        // Sesi habis saat editor terbuka: login ulang di atas editor tanpa menutup file.
        const onUnauthorized = () => setExpired(true);
        window.addEventListener('midas:unauthorized', onUnauthorized);
        return () => window.removeEventListener('midas:unauthorized', onUnauthorized);
    }, [phase]);

    if (error && phase !== 'ready')
        return (
            <div className="gate"><div className="gate-card"><h1>Midas is offline</h1><p className="gate-sub">{error}</p><button className="gate-primary" onClick={check}>Retry</button></div></div>
        );
    if (phase === 'checking') return <div className="gate" aria-busy="true" />;
    if (phase === 'auth') return <AuthScreen onSignedIn={afterSignIn} />;
    if (phase === 'import') return <LegacyImport files={legacy} onDone={() => setPhase('ready')} />;
    return (
        <>
            <Splash done={engineReady} />
            <Topbar user={user} />
            <main className="workspace">
                <LeftRail />
                <LeftPanel />
                <CanvasArea />
                <RightPanel />
            </main>
            <Overlays />
            {expired && <AuthScreen overlay onSignedIn={u => { setUser(u); setExpired(false); }} />}
            {error && <div className="toast" role="alert">{error}</div>}
        </>
    );
}
