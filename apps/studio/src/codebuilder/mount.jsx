// Dipanggil engine saat tab Code Builder pertama kali dibuka: panel React di rail kiri, Live DOM Renderer
// di-portal ke area canvas.
import { createRoot } from 'react-dom/client';
import { CodeBuilderPanel } from './Panel.jsx';

export function mountCodeBuilder(host, bridge) {
    host.innerHTML = '';
    const root = createRoot(host);
    root.render(<CodeBuilderPanel bridge={bridge} canvasHost={document.getElementById('canvas-area')} />);
    return root;
}
