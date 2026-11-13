// The desktop bridge: native open and save over the Tauri plugins, the tab state and shortcuts of a tab page,
// and the browser fallback (no Tauri global).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tauriGlobal, saveFilters, basename, createFileBridge, runMenuCommand, autoPlayInPlayTab, autoNewFile, tabCommandOf, startDesktop } from '../src/desktop/bridge.js';

class FakeKeyboardEvent {
    constructor(type, init) { Object.assign(this, init, { type }); }
}

class MemoryStore {
    constructor() { this.items = new Map(); }
    getItem(k) { return this.items.has(k) ? this.items.get(k) : null; }
    setItem(k, v) { this.items.set(k, String(v)); }
}

function fakeWindow({ tauri = null, activeElement = null, pasteWorks = true, pathname = '/', search = '' } = {}) {
    const dispatched = [];
    const execCalls = [];
    const listeners = {};
    const win = {
        __TAURI__: tauri,
        KeyboardEvent: FakeKeyboardEvent,
        dispatched,
        execCalls,
        listeners,
        location: { pathname, search, reloads: 0, reload() { this.reloads++; } },
        document: {
            activeElement,
            execCommand: (cmd, _ui, value) => {
                execCalls.push(cmd);
                if (cmd === 'insertText') win.insertedText = value;
                return cmd === 'paste' ? pasteWorks : true;
            },
            getElementById: () => null,
        },
        dispatchEvent: e => dispatched.push(e),
        addEventListener: (type, handler) => { listeners[type] = handler; },
    };
    return win;
}

function fakeTauri({ open = null, saveTo = null, bytes = new Uint8Array([7, 8, 9]), label = 'tab-1', clipboard = '' } = {}) {
    const calls = { open: [], save: [], read: [], write: [], listen: [], emit: [] };
    return {
        calls,
        clipboardManager: { readText: async () => clipboard },
        dialog: {
            open: async opts => { calls.open.push(opts); return open; },
            save: async opts => { calls.save.push(opts); return typeof saveTo === 'function' ? saveTo() : saveTo; },
        },
        fs: {
            readFile: async path => { calls.read.push(path); return bytes; },
            writeFile: async (path, data) => { calls.write.push({ path, data }); },
        },
        webview: {
            getCurrentWebview: () => ({ label }),
        },
        event: {
            listen: async (name, handler) => { calls.listen.push({ name, handler }); return () => { }; },
            emit: async (name, payload) => { calls.emit.push({ name, payload }); },
        },
    };
}

test('the Tauri global is absent in a browser, so the bridge does not start', () => {
    assert.equal(tauriGlobal(fakeWindow()), null);
    assert.equal(tauriGlobal(undefined), null);
    assert.equal(startDesktop(fakeWindow()), null);
});

test('the bridge starts only when the shell injects the Tauri global', () => {
    const tauri = fakeTauri();
    const win = fakeWindow({ tauri });
    assert.equal(tauriGlobal(win), tauri);
    assert.notEqual(startDesktop(win, { store: new MemoryStore() }), null);
    assert.equal(tauri.calls.listen[0].name, 'menu');
});

test('open: a cancelled dialog reads nothing and returns null', async () => {
    const tauri = fakeTauri({ open: null });
    const file = await createFileBridge(tauri).pick();
    assert.equal(file, null);
    assert.equal(tauri.calls.read.length, 0);
    assert.equal(tauri.calls.open[0].multiple, false);
    assert.ok(tauri.calls.open[0].filters[0].extensions.includes('midas'));
});

test('open: the picked file comes back as a File with its bytes and base name', async () => {
    const tauri = fakeTauri({ open: 'C:\\Users\\me\\Documents\\Hero.midas', bytes: new Uint8Array([0x1f, 0x8b, 1]) });
    const file = await createFileBridge(tauri).pick();
    assert.ok(file instanceof File);
    assert.equal(file.name, 'Hero.midas');
    assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [0x1f, 0x8b, 1]);
    assert.deepEqual(tauri.calls.read, ['C:\\Users\\me\\Documents\\Hero.midas']);
});

test('save: a cancelled dialog writes nothing and returns false', async () => {
    const tauri = fakeTauri({ saveTo: null });
    const saved = await createFileBridge(tauri, new MemoryStore()).saveFile(new Blob(['x']), 'Hero.midas', { key: 'doc-1' });
    assert.equal(saved, false);
    assert.equal(tauri.calls.write.length, 0);
});

test('save: the first Save asks for a path, writes there and remembers it', async () => {
    const tauri = fakeTauri({ saveTo: 'D:\\out\\Hero.midas' });
    const saved = await createFileBridge(tauri, new MemoryStore()).saveFile(new Blob([new Uint8Array([1, 2, 3])]), 'Hero.midas', { key: 'doc-1' });
    assert.equal(saved, true);
    assert.equal(tauri.calls.save[0].defaultPath, 'Hero.midas');
    assert.deepEqual(tauri.calls.save[0].filters, [{ name: 'MIDAS', extensions: ['midas'] }]);
    assert.equal(tauri.calls.write[0].path, 'D:\\out\\Hero.midas');
    assert.deepEqual([...tauri.calls.write[0].data], [1, 2, 3]);
});

test('save: later Saves reuse the remembered path without asking; Save As asks again', async () => {
    const store = new MemoryStore();
    const tauri = fakeTauri({ saveTo: 'D:\\out\\Hero.midas' });
    const files = createFileBridge(tauri, store);
    await files.saveFile(new Blob(['a']), 'Hero.midas', { key: 'doc-1' });
    await files.saveFile(new Blob(['b']), 'Hero.midas', { key: 'doc-1' });
    assert.equal(tauri.calls.save.length, 1, 'the second Save must not ask');
    assert.equal(tauri.calls.write.length, 2);
    assert.equal(tauri.calls.write[1].path, 'D:\\out\\Hero.midas');

    tauri.calls.save.length = 0;
    await files.saveFile(new Blob(['c']), 'Hero.midas', { key: 'doc-1', saveAs: true });
    assert.equal(tauri.calls.save.length, 1, 'Save As asks');
    assert.equal(tauri.calls.save[0].defaultPath, 'D:\\out\\Hero.midas');
});

test('save: the remembered path survives a restart (a new bridge on the same storage)', async () => {
    const store = new MemoryStore();
    await createFileBridge(fakeTauri({ saveTo: 'D:\\out\\Hero.midas' }), store).saveFile(new Blob(['a']), 'Hero.midas', { key: 'doc-1' });
    const after = fakeTauri({ saveTo: 'should-not-ask' });
    await createFileBridge(after, store).saveFile(new Blob(['b']), 'Hero.midas', { key: 'doc-1' });
    assert.equal(after.calls.save.length, 0);
    assert.equal(after.calls.write[0].path, 'D:\\out\\Hero.midas');
});

test('save: an export with no document key (PNG) asks every time and remembers nothing', async () => {
    const store = new MemoryStore();
    const tauri = fakeTauri({ saveTo: 'D:\\out\\Frame.png' });
    const files = createFileBridge(tauri, store);
    await files.saveFile(new Blob(['png']), 'Frame.png');
    await files.saveFile(new Blob(['png']), 'Frame.png');
    assert.equal(tauri.calls.save.length, 2);
    assert.deepEqual(tauri.calls.save[0].filters, [{ name: 'PNG', extensions: ['png'] }]);
    assert.equal(store.getItem('midas-desktop-save-paths'), null);
});

test('file helpers: extension filter and base name', () => {
    assert.deepEqual(saveFilters('Hero.midas'), [{ name: 'MIDAS', extensions: ['midas'] }]);
    assert.deepEqual(saveFilters('no-extension'), []);
    assert.equal(basename('C:\\a\\b\\Hero.midas'), 'Hero.midas');
    assert.equal(basename('/home/me/Hero.midas'), 'Hero.midas');
});

test('menu: a text field gets the native edit command, the editor gets its own key', async () => {
    const inField = fakeWindow({ activeElement: { tagName: 'INPUT' } });
    await runMenuCommand('copy', inField);
    assert.deepEqual(inField.execCalls, ['copy']);
    assert.equal(inField.dispatched.length, 0);

    const editor = fakeWindow({ activeElement: { tagName: 'DIV' } });
    await runMenuCommand('save', editor);
    assert.equal(editor.dispatched.length, 1);
    assert.equal(editor.dispatched[0].type, 'keydown');
    assert.equal(editor.dispatched[0].key, 's');
    assert.equal(editor.dispatched[0].ctrlKey, true);
    assert.deepEqual(editor.execCalls, []);

    await runMenuCommand('redo', editor);
    assert.equal(editor.dispatched[1].key, 'z');
    assert.equal(editor.dispatched[1].shiftKey, true);
});

test('paste: the menu pastes into a text field with the native command when it works', async () => {
    const win = fakeWindow({ tauri: fakeTauri(), activeElement: { tagName: 'INPUT' }, pasteWorks: true });
    await runMenuCommand('paste', win);
    assert.deepEqual(win.execCalls, ['paste']);
});

test('paste: when WebView2 refuses the native paste, the clipboard plugin text is inserted', async () => {
    const win = fakeWindow({ tauri: fakeTauri({ clipboard: 'hello' }), activeElement: { tagName: 'INPUT' }, pasteWorks: false });
    await runMenuCommand('paste', win);
    assert.deepEqual(win.execCalls, ['paste', 'insertText']);
    assert.equal(win.insertedText, 'hello');
});

test('menu: a command the studio registered runs instead of the default', async () => {
    const win = fakeWindow();
    const calls = [];
    await runMenuCommand('save-as', win, { 'save-as': () => calls.push('save-as') });
    assert.deepEqual(calls, ['save-as']);
    assert.equal(win.dispatched.length, 0);
});

test('menu: reload reloads the page, an unknown id does nothing', async () => {
    const win = fakeWindow();
    await runMenuCommand('reload', win);
    assert.equal(win.location.reloads, 1);
    await runMenuCommand('not-a-command', win);
    assert.equal(win.dispatched.length, 0);
});

test('tab keys: Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Shift+Tab and Ctrl+1..9 are tab commands; other keys are not', () => {
    assert.equal(tabCommandOf({ ctrlKey: true, key: 't' }), 'tab-new');
    assert.equal(tabCommandOf({ ctrlKey: true, key: 'w' }), 'tab-close');
    assert.equal(tabCommandOf({ ctrlKey: true, key: 'Tab' }), 'tab-next');
    assert.equal(tabCommandOf({ ctrlKey: true, shiftKey: true, key: 'Tab' }), 'tab-prev');
    assert.equal(tabCommandOf({ ctrlKey: true, key: '3' }), 'tab-3');
    assert.equal(tabCommandOf({ ctrlKey: true, shiftKey: true, key: 't' }), null);
    assert.equal(tabCommandOf({ ctrlKey: true, key: 's' }), null);
    assert.equal(tabCommandOf({ key: 't' }), null);
});

test('tab keys: a tab command key is sent to the shell and stopped before the studio sees it', async () => {
    const tauri = fakeTauri();
    const win = fakeWindow({ tauri });
    startDesktop(win, { store: new MemoryStore() });
    let stopped = false, prevented = false;
    win.listeners.keydown({ ctrlKey: true, key: 'w', preventDefault: () => (prevented = true), stopPropagation: () => (stopped = true) });
    assert.equal(prevented && stopped, true);
    assert.deepEqual(tauri.calls.emit.at(-1), { name: 'midas:tab-command', payload: { action: 'tab-close' } });

    let ignored = false;
    win.listeners.keydown({ ctrlKey: true, key: 's', preventDefault: () => (ignored = true), stopPropagation: () => { } });
    assert.equal(ignored, false, 'Ctrl+S stays with the studio');
});

test('tab state: a document tab reports its label, name, unsaved edits and route', () => {
    const tauri = fakeTauri({ label: 'tab-4' });
    const win = fakeWindow({ tauri, pathname: '/file/abc', search: '?page=p1' });
    const bridge = startDesktop(win, { store: new MemoryStore() });
    bridge.setDocument('Hero', true);
    const last = tauri.calls.emit.at(-1);
    assert.equal(last.name, 'midas:tab-state');
    assert.deepEqual(last.payload, { label: 'tab-4', name: 'Hero', unsaved: true, route: '/file/abc?page=p1' });
    bridge.setDocument('Hero', false);
    assert.equal(tauri.calls.emit.at(-1).payload.unsaved, false);
});

test('Play: a Play tab (label play-*) starts Play itself and never asks for another Play tab', async () => {
    let clicks = 0;
    const play = { disabled: false, click: () => clicks++ };
    const win = fakeWindow({ tauri: fakeTauri({ label: 'play-2' }) });
    win.document.getElementById = id => (id === 'play' ? play : null);
    const bridge = startDesktop(win, { store: new MemoryStore() });
    await new Promise(r => setTimeout(r, 300));
    assert.equal(clicks, 1);
    assert.equal(bridge.canOpenPlayWindow(), false);
});

test('Play: a document tab asks the shell for the Play tab with its route, and does not start Play itself', async () => {
    let started = 0;
    const tauri = fakeTauri({ label: 'tab-1' });
    const win = fakeWindow({ tauri, pathname: '/file/abc', search: '?page=page-1' });
    win.document.getElementById = () => ({ disabled: false, click: () => started++ });
    const bridge = startDesktop(win, { store: new MemoryStore() });
    assert.equal(bridge.canOpenPlayWindow(), true);
    await bridge.openPlayWindow();
    await new Promise(r => setTimeout(r, 300));
    assert.equal(started, 0);
    assert.deepEqual(tauri.calls.emit.at(-1), { name: 'midas:open-play', payload: { route: '/file/abc?page=page-1' } });
});

test('Play: the autoplay helper gives up when the Play button never appears', async () => {
    let clicks = 0;
    const win = fakeWindow();
    win.document.getElementById = () => null;
    autoPlayInPlayTab(win, { tries: 3, every: 1 });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(clicks, 0);
});

test('startDesktop: a menu event from the shell runs the command', async () => {
    const tauri = fakeTauri();
    const win = fakeWindow({ tauri });
    startDesktop(win, { store: new MemoryStore() });
    await tauri.calls.listen[0].handler({ payload: 'reload' });
    assert.equal(win.location.reloads, 1);
});

test('new file tab: the studio creates a file once its home list shows the New design file button', async () => {
    let clicks = 0;
    const win = fakeWindow();
    win.document.querySelector = sel => (sel === '[data-home-new="blank"]' ? { click: () => clicks++ } : null);
    autoNewFile(win, { tries: 50, every: 1 });
    await new Promise(r => setTimeout(r, 30));
    assert.equal(clicks, 1);
});
