import { useEffect, useState } from 'react';
import { Topbar, LeftRail, LeftPanel, CanvasArea, RightPanel, Overlays } from './components/Shell.jsx';
import { AuthScreen, LegacyImport, listLegacyFiles } from './components/Gate.jsx';
import { auth } from './storage.js';

let started = null;
function startEngine() {
    started ??= import('./engine/midas.js');
    return started;
}

export default function App() {
    // checking → (auth) → (import) → ready. Editor (engine) hanya dimulai saat ready.
    const [phase, setPhase] = useState('checking');
    const [user, setUser] = useState(null);
    const [legacy, setLegacy] = useState([]);
    const [expired, setExpired] = useState(false);
    const [error, setError] = useState(null);

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
        startEngine().catch(e => { console.error(e); setError(e.message); });
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
