// Static editor shell. The engine (src/engine/midas.js) finds these elements by id/class
// and fills panels, inspector and dialogs imperatively, so these components render once
// and never re-render.

const RailIcon = ({ children, viewBox = '0 0 24 24', strokeWidth = 1.5 }) => (
    <svg width="18" height="18" viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const VariablesIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="5" cy="5" r="2.6" /><circle cx="11" cy="5" r="2.6" /><circle cx="5" cy="11" r="2.6" /><circle cx="11" cy="11" r="2.6" />
    </svg>
);

export function Topbar({ user }) {
    return (
        <header className="topbar">
            <div className="brand-section">
                <button className="brand" id="main-menu" aria-label="Midas menu" title="Midas menu">
                    <svg width="23" height="23" viewBox="0 0 32 32"><path d="M4 28V6h6.5L16 17.5 21.5 6H28v22h-5.5V15.5L18 26h-4l-4.5-10.5V28Z" fill="currentColor" /></svg>
                    <span>midas</span><span className="brand-chevron"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span>
                </button>
                <div className="top-divider"></div>
                <button className="icon-button" id="go-home" title="All files" aria-label="All files">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></svg>
                </button>
                <button className="icon-button" id="toggle-left" title="Toggle layers panel" aria-label="Toggle layers panel" data-icon="panel"></button>
            </div>
            <div className="file-breadcrumb">
                <button className="crumb-link" id="crumb-home" title="Back to all files">Workspace</button>
                <span className="crumb-slash">/</span>
                <button id="file-name" title="Rename document">Untitled</button>
                <span className="save-indicator" id="save-indicator"><i></i> Saved</span>
            </div>
            <div className="top-actions">
                <button className="avatar" id="profile" title={user ? `${user.name} · ${user.email}` : 'Account'}>{(user?.name || user?.email || 'M').trim().charAt(0).toUpperCase()}</button>
                {/* Sementara masih presentasi frame; nanti menjadi Preview App milik Code Builder (spec §4.5). */}
                <button className="icon-button" id="present" title="Preview app" aria-label="Preview app" data-icon="play"></button>
                <button className="share-button" id="share" title="Save a portable Midas file">Export <span data-icon="arrowUpRight"></span></button>
            </div>
        </header>
    );
}

export function LeftRail() {
    return (
        <nav className="left-rail" aria-label="Sidebar">
            <button className="rail-btn active" data-rail="design" title="Design" aria-label="Design">
                <RailIcon><path d="m12 3 10 6-10 6L2 9ZM2 14l10 6 10-6" /></RailIcon>
            </button>
            <button className="rail-btn" data-rail="assets" title="Components" aria-label="Components">
                <RailIcon><path d="m12 2 4 4-4 4-4-4ZM18 8l4 4-4 4-4-4ZM6 8l4 4-4 4-4-4ZM12 14l4 4-4 4-4-4Z" /></RailIcon>
            </button>
            <button className="rail-btn" data-rail="variables" title="Variables" aria-label="Variables"><VariablesIcon size={18} /></button>
            <button className="rail-btn" data-rail="plugins" title="Plugins" aria-label="Plugins">
                <RailIcon><path d="M9 3v3.2a1.8 1.8 0 0 1-1.8 1.8H4v4h1.6a1.9 1.9 0 1 1 0 3.8H4V19a2 2 0 0 0 2 2h3.2v-1.6a1.9 1.9 0 1 1 3.8 0V21H16a2 2 0 0 0 2-2v-3.2h1.6a1.9 1.9 0 1 0 0-3.8H18V8a2 2 0 0 0-2-2h-1.2V4.4a1.9 1.9 0 1 0-3.8 0V3Z" /></RailIcon>
            </button>
            <button className="rail-btn" data-rail="code-builder" title="Code Builder" aria-label="Code Builder">
                <RailIcon><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" /></RailIcon>
            </button>
        </nav>
    );
}

export function LeftPanel() {
    return (
        <aside className="left-panel" id="left-panel" aria-label="Pages and layers">
            <div className="left-heading">
                <div className="lh-text">
                    <div className="lh-row">
                        <span id="left-heading-title" title="Double-click to rename">Design file</span>
                        <button className="lh-chev" id="left-heading-menu" title="File options" aria-label="File options" aria-haspopup="menu"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></button>
                    </div>
                    <small id="left-heading-folder"></small>
                </div>
            </div>
            <div className="layer-search-box hidden" id="layer-search-box">
                <div className="layer-search" id="layer-search">
                    <span data-icon="search"></span>
                    <input id="search-layers" placeholder="Find…" aria-label="Find layers and text" autoComplete="off" spellCheck="false" />
                    <button className="icon-button small" id="search-options" title="Search options" aria-label="Search options" data-icon="sliders"></button>
                    <button className="icon-button small" id="search-close" title="Close search (Esc)" aria-label="Close search" data-icon="close"></button>
                </div>
                <div className="search-replace hidden" id="search-replace">
                    <label className="replace-field"><span data-icon="arrowRight"></span><input id="replace-layers" placeholder="Replace with…" aria-label="Replace with" autoComplete="off" spellCheck="false" /></label>
                    <div className="replace-actions">
                        <button className="wide-button" id="replace-one" title="Replace the selected result (Enter)">Replace</button>
                        <button className="wide-button" id="replace-all" title="Replace every result (Ctrl+Enter)">Replace all</button>
                    </div>
                </div>
            </div>
            <div id="search-results" className="search-results hidden" role="listbox" aria-label="Search results"></div>
            <div className="pages-heading" id="pages-heading"><span>Pages</span><span className="pages-actions"><button className="icon-button small" id="search-button" title="Find layers (Ctrl+F)" aria-label="Find layers" data-icon="search"></button><button className="icon-button small" id="add-page" title="Add page" aria-label="Add page" data-icon="plus"></button></span></div>
            <div id="page-list" className="page-list"></div>
            <div className="pages-split" id="pages-split" role="separator" aria-orientation="horizontal" aria-label="Resize pages panel" title="Drag to resize"></div>
            <div className="layers-heading" id="layers-heading"><span id="tree-heading">Layers</span><span className="muted" id="layer-count"></span></div>
            <div id="layer-tree" className="layer-tree" role="tree" aria-label="Layers"></div>
            <div id="assets-panel" className="assets-panel hidden"></div>
            <div id="plugins-panel" className="assets-panel plugins-panel hidden"></div>
            <div id="code-builder-panel" className="assets-panel code-builder-panel hidden"></div>
            <div className="left-footer">
                <div className="engine-dot"></div>
                <span id="engine-label">Starting renderer</span>
                <button className="icon-button small" id="settings" title="Editor settings" aria-label="Editor settings" data-icon="sliders"></button>
            </div>
        </aside>
    );
}

const TOOLS = [
    ['select', 'Move (V)', 'Move', 'cursor'],
    ['frame', 'Frame (F)', 'Frame', 'frame'],
    ['section', 'Section (⇧S)', 'Section', 'section'],
    null,
    ['rect', 'Rectangle (R)', 'Rectangle', 'rect'],
    ['ellipse', 'Ellipse (O)', 'Ellipse', 'ellipse'],
    ['line', 'Line (L)', 'Line', 'line'],
    ['pen', 'Pen (P) · click points, Enter to finish', 'Pen', 'pen'],
    ['text', 'Text (T)', 'Text', 'text'],
    null,
    ['hand', 'Hand (H)', 'Hand', 'hand'],
];

export function CanvasArea() {
    return (
        <section className="canvas-area" id="canvas-area" aria-label="Design canvas">
            <div className="canvas-world" id="canvas-world"></div>
            <canvas id="scene" aria-label="Editable design canvas"></canvas>
            <canvas id="overlay" tabIndex={0} aria-label="Canvas interaction area"></canvas>
            <div className="canvas-topline">
                <span className="canvas-crumb" id="canvas-page-name">Design exploration</span>
                <button className="canvas-pill" id="canvas-status"><i></i><span>All changes saved to your workspace</span></button>
            </div>
            <div id="text-editor" contentEditable="plaintext-only" suppressContentEditableWarning className="text-editor hidden" role="textbox" aria-multiline="true" spellCheck="false"></div>
            <div className="canvas-footer">
                <span className="canvas-hint" id="canvas-hint">Space to pan <span>·</span> ⌘ scroll to zoom <span>·</span> ? for shortcuts</span>
                <span className="performance" id="performance"></span>
            </div>
            <div className="floating-toolbar" id="toolbar" role="toolbar" aria-label="Design tools">
                {TOOLS.map((t, i) => t
                    ? <button key={t[0]} className={'tool' + (t[0] === 'select' ? ' active' : '')} data-tool={t[0]} title={t[1]} aria-label={t[2]} data-icon={t[3]}></button>
                    : <div key={'d' + i} className="toolbar-divider"></div>)}
                <button className="tool" id="insert-image" title="Place image (⇧⌘K)" aria-label="Place image" data-icon="image"></button>
                <div className="toolbar-divider"></div>
                <button className="tool accent-tool" id="command-button" title="Commands (⌘K)" aria-label="Command palette" data-icon="sparkles"></button>
            </div>
            <div className="zoom-controls">
                <button id="zoom-out" className="icon-button small" title="Zoom out" aria-label="Zoom out" data-icon="minus"></button>
                <button id="zoom-value" title="Zoom options">100%</button>
                <button id="zoom-in" className="icon-button small" title="Zoom in" aria-label="Zoom in" data-icon="plus"></button>
            </div>
        </section>
    );
}

export function RightPanel() {
    return (
        <aside className="right-panel" id="right-panel" aria-label="Properties inspector">
            <div className="inspector-tabs">
                <button className="active" data-inspector-tab="design">Design</button>
                <button className="icon-button small" id="theme-toggle" title="Toggle light / dark theme" aria-label="Toggle theme" data-icon="sun"></button>
            </div>
            <div className="inspector-scroll" id="inspector"></div>
            <div className="inspector-footer">
                <span>Midas by Akar Inti Teknologi</span>
                <button className="icon-button small" id="help" title="Keyboard shortcuts" aria-label="Keyboard shortcuts" data-icon="help"></button>
            </div>
        </aside>
    );
}

const IMAGE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

export function Overlays() {
    return (
        <>
            <div id="context-menu" className="context-menu hidden" role="menu"></div>
            <div id="toast" className="toast hidden" role="status" aria-live="polite"></div>
            <div id="modal-backdrop" className="modal-backdrop hidden"><section id="modal" className="modal" role="dialog" aria-modal="true" aria-label="Editor dialog"></section></div>
            <div id="presentation" className="presentation hidden">
                <div className="presentation-toolbar">
                    <span>midas <span className="muted">/ Preview</span></span>
                    <span id="presentation-title"></span>
                    <div>
                        <button id="prev-frame" className="icon-button" aria-label="Previous frame" data-icon="arrowLeft"></button>
                        <span id="presentation-count"></span>
                        <button id="next-frame" className="icon-button" aria-label="Next frame" data-icon="arrowRight"></button>
                        <button id="close-presentation" className="icon-button" aria-label="Close preview" data-icon="close"></button>
                    </div>
                </div>
                <div className="presentation-stage" id="presentation-stage"><canvas id="presentation-canvas"></canvas></div>
            </div>
            <input type="file" id="file-input" accept=".midas,.vellum,.fig,.json,application/json" hidden />
            <input type="file" id="fill-image-input" accept={IMAGE_TYPES} hidden />
            <input type="file" id="image-input" accept={IMAGE_TYPES} hidden />
        </>
    );
}
