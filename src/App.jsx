import { useEffect, useState } from 'react';
import { Topbar, LeftRail, LeftPanel, CanvasArea, RightPanel, Overlays } from './components/Shell.jsx';
import { loadSettings } from './storage.js';

let started = null;
function startEngine() {
    // Settings must be in memory before the engine reads them synchronously at startup.
    started ??= loadSettings().then(() => import('./engine/midas.js'));
    return started;
}

export default function App() {
    const [error, setError] = useState(null);
    useEffect(() => { startEngine().catch(e => { console.error(e); setError(e.message); }); }, []);
    return (
        <>
            <Topbar />
            <main className="workspace">
                <LeftRail />
                <LeftPanel />
                <CanvasArea />
                <RightPanel />
            </main>
            <Overlays />
            {error && <div className="toast" role="alert">{error}</div>}
        </>
    );
}
