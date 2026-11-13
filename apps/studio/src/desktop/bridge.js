// Desktop bridge for the Midas desktop shell (src-tauri). Active only when the page runs inside Tauri:
// `window.__TAURI__` is the global the shell injects (withGlobalTauri) and it is granted to the server
// origin only. In a browser `startDesktop()` returns null and the editor keeps its own file input and
// download, so the web studio behaves as before.

const MIDAS_OPEN = [{ name: 'Midas document', extensions: ['midas', 'vellum', 'json', 'fig'] }];
const PATHS_KEY = 'midas-desktop-save-paths';
// The window label of the Play window (src-tauri: PLAY). The label is the Tauri window's own, not the URL,
// because the studio's router rewrites the URL.
const PLAY_LABEL = 'play';

/** The Tauri global of `win`, or null in a browser. */
export function tauriGlobal(win = globalThis.window) {
    return win?.__TAURI__ ?? null;
}

/** Filter for a save of `name`, by its extension (.midas, .png, .svg, .json ...). */
export function saveFilters(name) {
    const ext = /\.([^.\\/]+)$/.exec(name || '')?.[1]?.toLowerCase();
    return ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : [];
}

export const basename = path => String(path).split(/[\\/]/).pop();

/** Window title: the document name, with a dot while the server copy has edits not yet saved. */
export function titleFor(name, unsaved) {
    return `${unsaved ? '• ' : ''}${name || 'Untitled'} — Midas`;
}

const readPaths = store => {
    try {
        return JSON.parse(store?.getItem(PATHS_KEY) || '{}');
    } catch {
        return {};
    }
};

const writePaths = (store, paths) => {
    try {
        store?.setItem(PATHS_KEY, JSON.stringify(paths));
    } catch {
        // The remembered path is a convenience: without storage Save asks again.
    }
};

/**
 * Native open and save over the dialog and fs plugins. `tauri` is the injected `__TAURI__` global (or a test
 * double); `store` keeps the save path of each document (`key`), so Save writes there without asking.
 * `pick` gives null when the user cancels; `saveFile` gives false for the same.
 */
export function createFileBridge(tauri, store = null) {
    const paths = readPaths(store);
    return {
        async pick() {
            const selected = await tauri.dialog.open({ multiple: false, directory: false, filters: MIDAS_OPEN });
            if (!selected) return null;
            const bytes = await tauri.fs.readFile(selected);
            return new File([bytes], basename(selected), { type: 'application/octet-stream' });
        },
        async saveFile(blob, name, { key, saveAs = false } = {}) {
            let path = !saveAs && key ? paths[key] : undefined;
            if (!path) {
                path = await tauri.dialog.save({ defaultPath: key && paths[key] ? paths[key] : name, filters: saveFilters(name) });
                if (!path) return false;
                if (key) {
                    paths[key] = path;
                    writePaths(store, paths);
                }
            }
            await tauri.fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
            return true;
        },
    };
}

const SHORTCUTS = {
    new: { key: 'n', ctrlKey: true },
    open: { key: 'o', ctrlKey: true },
    save: { key: 's', ctrlKey: true },
    undo: { key: 'z', ctrlKey: true },
    redo: { key: 'z', ctrlKey: true, shiftKey: true },
    copy: { key: 'c', ctrlKey: true },
    paste: { key: 'v', ctrlKey: true },
    duplicate: { key: 'd', ctrlKey: true },
    'select-all': { key: 'a', ctrlKey: true },
    delete: { key: 'Delete' },
};

const TEXT_COMMANDS = { copy: 'copy', 'select-all': 'selectAll', undo: 'undo', redo: 'redo' };

/**
 * Paste into a text field. The native paste command is tried first; WebView2 refuses it outside a key press
 * (a menu click is not one), so the clipboard text is read through the shell's clipboard plugin and inserted.
 * `navigator.clipboard` is not used: WebView2 answers it with a permission prompt.
 */
async function pasteIntoField(win, tauri) {
    if (win.document.execCommand('paste')) return true;
    const text = await tauri.clipboardManager.readText();
    return win.document.execCommand('insertText', false, text);
}

/**
 * Runs a menu command. A command the studio registered runs first (`commands`). In a text field the native
 * edit command runs; elsewhere the editor gets the same key it already handles, so menu and keyboard share
 * one code path (no duplicate handler).
 */
export async function runMenuCommand(id, win = globalThis.window, commands = {}) {
    if (commands[id]) return commands[id]();
    const doc = win.document;
    if (id === 'reload') return win.location.reload();
    const active = doc.activeElement;
    const inText = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    if (inText && id === 'paste') return pasteIntoField(win, win.__TAURI__);
    if (inText && TEXT_COMMANDS[id]) return doc.execCommand(TEXT_COMMANDS[id]);
    const spec = SHORTCUTS[id];
    if (!spec) return;
    win.dispatchEvent(new win.KeyboardEvent('keydown', { ...spec, bubbles: true, cancelable: true }));
}

/** Play window: starts Play once the editor's Play button exists (the document is loaded by then). */
export function autoPlayInPlayWindow(win = globalThis.window, { tries = 150, every = 200 } = {}) {
    let left = tries;
    const timer = setInterval(() => {
        const play = win.document.getElementById('play');
        if (play && !play.disabled) {
            clearInterval(timer);
            play.click();
        } else if (--left <= 0) clearInterval(timer);
    }, every);
}

/**
 * Starts the bridge in the desktop shell: menu commands, window title, native file access and the Play
 * window. Returns null in a browser. `commands` maps menu ids to studio actions (for example save-as, play);
 * `onError` receives failures of native file access so the editor can show them.
 */
export function startDesktop(win = globalThis.window, { onError = () => { }, commands = {}, store = win?.localStorage } = {}) {
    const tauri = tauriGlobal(win);
    if (!tauri) return null;
    const files = createFileBridge(tauri, store);
    const state = { name: 'Untitled', unsaved: false, title: '' };
    const setTitle = () => {
        const title = titleFor(state.name, state.unsaved);
        if (title === state.title) return;
        state.title = title;
        tauri.window.getCurrentWindow().setTitle(title).catch(onError);
    };
    tauri.event.listen('menu', event => runMenuCommand(event.payload, win, commands)).catch(onError);
    const label = tauri.window.getCurrentWindow().label;
    if (label === PLAY_LABEL) autoPlayInPlayWindow(win);
    return {
        pick: () => files.pick(),
        saveFile: (blob, name, options) => files.saveFile(blob, name, options),
        /** The open document and whether its server copy has edits not yet saved. */
        setDocument(name, unsaved) {
            state.name = name || state.name;
            state.unsaved = !!unsaved;
            setTitle();
        },
        /** Play runs in its own window; the editor window is the one that asks for it. */
        canOpenPlayWindow: () => label !== PLAY_LABEL,
        /** Asks the shell for the Play window, on the route of the open document. */
        openPlayWindow: () => tauri.event.emit('midas:open-play', { route: win.location.pathname + win.location.search }).catch(onError),
    };
}
