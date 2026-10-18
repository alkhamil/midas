// Confirmation dialogs for Midas Studio (replaces the browser's confirm()). Both helpers resolve a Promise, so call
// sites just `await` them. Esc / backdrop click cancel, Enter confirms.
let open = null;

function build({ title, message, actions, danger }) {
    const root = document.createElement('div');
    root.className = 'mc-backdrop';
    root.innerHTML = `<div class="mc-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mc-title" aria-describedby="mc-message">
        <h2 id="mc-title"></h2><p id="mc-message"></p><div class="mc-actions"></div></div>`;
    root.querySelector('#mc-title').textContent = title;
    root.querySelector('#mc-message').textContent = message || '';
    root.querySelector('#mc-message').hidden = !message;
    const bar = root.querySelector('.mc-actions');
    for (const a of actions) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = a.label;
        b.className = `mc-btn ${a.primary ? (danger ? 'danger' : 'primary') : ''}`;
        b.dataset.value = String(a.value);
        bar.append(b);
    }
    return root;
}

/** Generic dialog: resolves with the clicked action's `value`, or `null` when dismissed. */
export function choiceDialog({ title, message = '', actions, danger = false }) {
    open?.cancel();
    return new Promise(resolve => {
        const root = build({ title, message, actions, danger });
        const previous = document.activeElement;
        const finish = value => {
            root.remove();
            document.removeEventListener('keydown', onKey, true);
            open = null;
            previous?.focus?.();
            resolve(value);
        };
        const primary = actions.find(a => a.primary) || actions.at(-1);
        const onKey = e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
            else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(primary.value); }
        };
        root.addEventListener('mousedown', e => { if (e.target === root) finish(null); });
        root.addEventListener('click', e => {
            const b = e.target.closest('.mc-btn');
            if (b) finish(actions.find(a => String(a.value) === b.dataset.value).value);
        });
        document.addEventListener('keydown', onKey, true);
        document.body.append(root);
        root.querySelector('.mc-btn.primary, .mc-btn.danger, .mc-btn:last-child')?.focus();
        open = { cancel: () => finish(null) };
    });
}

/** Yes/no confirmation → Promise<boolean>. */
export async function confirmDialog({ title, message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
    return (await choiceDialog({ title, message, danger, actions: [{ label: cancelLabel, value: false }, { label: confirmLabel, value: true, primary: true }] })) === true;
}
