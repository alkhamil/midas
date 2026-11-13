// The desktop app menu: the studio's logo opens File, Edit, View and Window (desktop app only; the web studio keeps
// its own menu). Items run the same actions as the old native menu bar: the editor's own functions, the in-page
// edit commands, and the shell's app commands (quit, Server URL, full screen, tab commands).

/** The menu model: groups of items. `actions` gives the editor's functions, `desktop` the bridge. */
export function desktopMenuGroups({ actions, desktop }) {
    const app = (action) => () => desktop.appCommand(action);
    const edit = (id) => () => desktop.command(id);
    return [
        {
            label: 'File',
            items: [
                { label: 'New', key: 'Ctrl+N', run: actions.newFile },
                { label: 'Open…', key: 'Ctrl+O', run: actions.openFile },
                { label: 'Save', key: 'Ctrl+S', run: actions.saveFile },
                { label: 'Save As…', run: () => actions.saveFile(true) },
                { label: 'Export…', run: actions.exportFile },
                { separator: true },
                { label: 'Close Tab', key: 'Ctrl+W', run: app('tab-close') },
                { label: 'Quit Midas', key: 'Ctrl+Q', run: app('quit') },
            ],
        },
        {
            label: 'Edit',
            items: [
                { label: 'Undo', key: 'Ctrl+Z', run: edit('undo') },
                { label: 'Redo', key: 'Ctrl+Shift+Z', run: edit('redo') },
                { separator: true },
                { label: 'Copy', key: 'Ctrl+C', run: edit('copy') },
                { label: 'Paste', key: 'Ctrl+V', run: edit('paste') },
                { label: 'Duplicate', key: 'Ctrl+D', run: edit('duplicate') },
                { label: 'Select All', key: 'Ctrl+A', run: edit('select-all') },
                { label: 'Delete', key: 'Del', run: edit('delete') },
            ],
        },
        {
            label: 'View',
            items: [
                { label: 'Reload', key: 'Ctrl+R', run: edit('reload') },
                { label: 'Full Screen', key: 'F11', run: app('fullscreen') },
            ],
        },
        {
            label: 'Window',
            items: [
                { label: 'Next Tab', key: 'Ctrl+Tab', run: app('tab-next') },
                { label: 'Previous Tab', key: 'Ctrl+Shift+Tab', run: app('tab-prev') },
                { separator: true },
                { label: 'Play in New Tab', run: actions.startPlay },
                { label: 'Server URL…', run: app('server-url') },
            ],
        },
    ];
}

/**
 * Opens the menu under `anchor`. Top-level groups open their submenu on hover, arrow right or Enter, to the side.
 * Arrow keys move, Esc closes, a click outside closes. Returns a close function.
 */
export function openAppMenu(anchor, groups, doc = globalThis.document) {
    const panel = doc.createElement('div');
    panel.className = 'context-menu app-menu';
    panel.setAttribute('role', 'menu');
    const tops = [];
    const subs = [];
    let openIndex = -1;

    const closeSub = () => {
        subs.forEach(s => s.remove());
        subs.length = 0;
        tops.forEach(t => t.classList.remove('open'));
        openIndex = -1;
    };
    const close = () => {
        closeSub();
        panel.remove();
        doc.removeEventListener('mousedown', outside, true);
        doc.removeEventListener('keydown', keys, true);
    };
    const outside = (e) => { if (!panel.contains(e.target) && !anchor.contains(e.target)) close(); };

    const openGroup = (i) => {
        closeSub();
        openIndex = i;
        const top = tops[i];
        top.classList.add('open');
        const sub = doc.createElement('div');
        sub.className = 'context-menu app-menu-sub';
        sub.setAttribute('role', 'menu');
        groups[i].items.forEach((item) => {
            if (item.separator) {
                const sep = doc.createElement('div');
                sep.className = 'menu-divider';
                sub.append(sep);
                return;
            }
            const b = doc.createElement('button');
            b.className = 'menu-item';
            b.setAttribute('role', 'menuitem');
            b.disabled = !!item.disabled;
            b.innerHTML = '<span class="menu-label"></span><span class="shortcut"></span>';
            b.querySelector('.menu-label').textContent = item.label;
            b.querySelector('.shortcut').textContent = item.key || '';
            b.onclick = () => { close(); item.run?.(); };
            sub.append(b);
        });
        const rect = top.getBoundingClientRect();
        sub.style.left = rect.right + 'px';
        sub.style.top = rect.top + 'px';
        doc.body.append(sub);
        subs.push(sub);
    };

    groups.forEach((group, i) => {
        const top = doc.createElement('button');
        top.className = 'app-menu-top';
        top.setAttribute('role', 'menuitem');
        top.textContent = group.label;
        top.onmouseenter = () => openGroup(i);
        top.onclick = () => (openIndex === i ? closeSub() : openGroup(i));
        panel.append(top);
        tops.push(top);
    });

    const focusables = () => [...(subs[0]?.querySelectorAll('.menu-item:not(:disabled)') ?? [])];
    const keys = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const next = (openIndex + (e.key === 'ArrowRight' ? 1 : -1) + groups.length) % groups.length;
            openGroup(next);
            tops[next].focus();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const list = focusables();
            if (!list.length) return;
            const at = list.indexOf(doc.activeElement);
            const step = e.key === 'ArrowDown' ? 1 : -1;
            list[(at + step + list.length) % list.length].focus();
        } else if (e.key === 'Enter' && doc.activeElement?.classList.contains('app-menu-top')) {
            e.preventDefault();
            openGroup(tops.indexOf(doc.activeElement));
            focusables()[0]?.focus();
        }
    };

    const box = anchor.getBoundingClientRect();
    panel.style.left = box.left + 'px';
    panel.style.top = box.bottom + 4 + 'px';
    doc.body.append(panel);
    doc.addEventListener('mousedown', outside, true);
    doc.addEventListener('keydown', keys, true);
    tops[0]?.focus();
    return close;
}
