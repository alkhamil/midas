// The desktop app menu model: its four groups and what each item runs (the editor's actions, the page's edit
// commands, the shell's app commands). The renderer is not run here; the browser check covers it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desktopMenuGroups } from '../src/desktop/appMenu.js';

function fakes() {
    const calls = [];
    const record = name => (...args) => calls.push([name, ...args]);
    const actions = {
        newFile: record('newFile'), openFile: record('openFile'), saveFile: record('saveFile'),
        exportFile: record('exportFile'), startPlay: record('startPlay'),
    };
    const desktop = {
        command: id => calls.push(['command', id]),
        appCommand: action => calls.push(['app', action]),
    };
    return { calls, groups: desktopMenuGroups({ actions, desktop }), actions };
}

const item = (groups, group, label) => groups.find(g => g.label === group).items.find(i => i.label === label);

test('the menu has File, Edit, View and Window, in that order', () => {
    const { groups } = fakes();
    assert.deepEqual(groups.map(g => g.label), ['File', 'Edit', 'View', 'Window']);
});

test('File items run the editor actions; Save As asks for a save path', () => {
    const { groups, calls } = fakes();
    item(groups, 'File', 'New').run();
    item(groups, 'File', 'Open…').run();
    item(groups, 'File', 'Save').run();
    item(groups, 'File', 'Save As…').run();
    item(groups, 'File', 'Export…').run();
    assert.deepEqual(calls.map(c => c[0]), ['newFile', 'openFile', 'saveFile', 'saveFile', 'exportFile']);
    assert.equal(calls[3][1], true, 'Save As passes saveAs=true');
});

test('Edit items send the page edit commands, the same ids the old menu bar sent', () => {
    const { groups, calls } = fakes();
    for (const label of ['Undo', 'Redo', 'Copy', 'Paste', 'Duplicate', 'Select All', 'Delete']) item(groups, 'Edit', label).run();
    assert.deepEqual(calls.map(c => c[1]), ['undo', 'redo', 'copy', 'paste', 'duplicate', 'select-all', 'delete']);
});

test('Close Tab, Quit, Full Screen, Next and Previous Tab and Server URL are app commands', () => {
    const { groups, calls } = fakes();
    item(groups, 'File', 'Close Tab').run();
    item(groups, 'File', 'Quit Midas').run();
    item(groups, 'View', 'Full Screen').run();
    item(groups, 'Window', 'Next Tab').run();
    item(groups, 'Window', 'Previous Tab').run();
    item(groups, 'Window', 'Server URL…').run();
    assert.deepEqual(calls.map(c => c[1]), ['tab-close', 'quit', 'fullscreen', 'tab-next', 'tab-prev', 'server-url']);
    assert.ok(calls.every(c => c[0] === 'app'));
});

test('Play in New Tab runs the studio Play action', () => {
    const { groups, calls } = fakes();
    item(groups, 'Window', 'Play in New Tab').run();
    assert.deepEqual(calls, [['startPlay']]);
});

test('separators are items without a label, and every shortcut is shown next to its item', () => {
    const { groups } = fakes();
    const fileItems = groups.find(g => g.label === 'File').items;
    assert.ok(fileItems.some(i => i.separator));
    assert.equal(item(groups, 'File', 'Save').key, 'Ctrl+S');
    assert.equal(item(groups, 'Edit', 'Redo').key, 'Ctrl+Shift+Z');
});
