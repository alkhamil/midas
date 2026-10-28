// Play: the DOM preview of a prototype, laid out like Figma's prototype viewer. A full window overlay mounts the descriptor tree of one
// frame (toDomTree) as real DOM and binds each node's mouse events to the player. Previous and next, Restart and every navigation go
// through the player, so the history stays consistent. Play reads the document and never writes it: the view settings live in the
// browser (localStorage), not in the document. The chrome (top bar, bottom controls) hides on a click that triggers nothing, and
// Ctrl+\ pins it hidden.
import { toDomTree, createPlayer, respond, playContext, eventFromDom, isDisabledTarget, transitionCss, timersFor, viewportLayout, chromeVisibility, stepFrame, resolveScalingMode, nextScalingMode, SCALING_MODES } from '@midas/builder-core';

const PREFS_KEY = 'midas.play';
const DEFAULT_PREFS = { mode: 'fit-width-and-height', background: '#1e1e20', hotspots: false, resetOnRestart: true };
/** How long the one-time "toolbar hidden" toast and the scaling label stay on screen. */
const TOAST_MS = 3000;
const MODE_LABEL_MS = 1000;
const MODE_LABELS = { 'actual-size': 'Actual size (100%)', responsive: 'Responsive', 'fit-width': 'Fit width', 'fit-width-and-height': 'Fit width and height' };
/** Constraints are not in the data model yet, so Responsive only adapts auto layout frames. Said under the mode, not hidden. */
const RESPONSIVE_NOTE = 'Auto layout frames adapt; plain frames keep fixed positions';
const ICONS = {
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    chevronDown: '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    prev: '<path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    next: '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    restart: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
};

/** The view settings the user chose last, from the browser. A stored view mode is migrated; a value that cannot be read gives the defaults. */
function loadPlayPrefs() {
    let stored = {};
    try {
        const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        if (parsed && typeof parsed === 'object') stored = parsed;
    }
    catch {
        stored = {};
    }
    const prefs = { ...DEFAULT_PREFS, ...stored };
    prefs.mode = 'mode' in stored ? resolveScalingMode(stored.mode) : DEFAULT_PREFS.mode;
    return prefs;
}

/** @param {typeof DEFAULT_PREFS} prefs */
function savePlayPrefs(prefs) {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }
    catch {
        // Storage can be blocked (private windows): the settings then last for this Play only.
    }
}

/** An icon button for the chrome. */
function iconButton(icon, label, extra = '') {
    return `<button type="button" class="play-icon-button" aria-label="${label}" title="${label}" ${extra}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg></button>`;
}

/** @param {string} text */
function escapeText(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Whether a pointer is on the scrollbar of a layer that scrolls: past its content box on either axis. A scrollbar never triggers an
 * interaction.
 * @param {HTMLElement} el
 * @param {MouseEvent} e
 */
function onScrollbar(el, e) {
    if (el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth) return false;
    const r = el.getBoundingClientRect();
    return e.clientX > r.left + el.clientLeft + el.clientWidth || e.clientY > r.top + el.clientTop + el.clientHeight;
}

/**
 * Opens Play. Returns the function that closes it.
 * @param {{ data: { pages: any[], variables?: any }, startFrameId: string, name?: string, flows?: { id: string, name: string, startFrameId: string }[], pageFrames?: string[] }} options
 *   `data` is the document data, read only. `pageFrames` are the frames the previous and next controls walk through (the flow's page).
 */
export function openPlay({ data, startFrameId, name = 'Prototype', flows = [], pageFrames = [] }) {
    const ctx = playContext(data.pages);
    const nodeById = new Map(data.pages.flatMap(p => (p.nodes || []).map(n => [n.id, n])));
    const prefs = loadPlayPrefs();
    let state = createPlayer(startFrameId);
    let frameId = startFrameId;
    let flowStart = startFrameId;
    let menu = null;
    let chrome = { visible: true, pinnedHidden: false };
    let toastShown = false;
    /** The mouse press in progress: what it was on, and whether its events triggered an interaction. */
    let press = null;
    let lastWidth = 0;
    let lastHeight = 0;
    const timers = new Map();
    const transitions = new Set();
    let toastTimer = null;
    let labelTimer = null;

    const overlay = document.createElement('div');
    overlay.className = 'play-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Play prototype');
    overlay.style.background = prefs.background;
    overlay.innerHTML = `
        <header class="play-topbar">
            <button type="button" class="play-flow-button" aria-haspopup="menu"><span class="play-flow-name">${escapeText(name)}</span> <span class="play-chevron">${'<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS.chevronDown + '</svg>'}</span></button>
            <span class="play-spacer"></span>
            ${iconButton('sliders', 'View options', 'aria-haspopup="menu"')}
            ${iconButton('fullscreen', 'Full screen')}
            ${iconButton('close', 'Close (Esc)')}
        </header>
        <div class="play-viewport"><div class="play-sizer"><div class="play-stage"></div></div></div>
        <footer class="play-bottom">
            <span class="play-badge" hidden></span>
            <div class="play-pill">
                <button type="button" class="play-icon-button" data-step="prev" aria-label="Previous frame" title="Previous frame">${'<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS.prev + '</svg>'}</button>
                <span class="play-counter"></span>
                <button type="button" class="play-icon-button" data-step="next" aria-label="Next frame" title="Next frame">${'<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS.next + '</svg>'}</button>
            </div>
            <div class="play-restart">
                <button type="button" class="play-icon-button" data-restart aria-label="Restart" title="Restart (R)">${'<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS.restart + '</svg>'}</button>
                <kbd>R</kbd>
            </div>
        </footer>
        <div class="play-menu play-view-menu" role="menu" hidden></div>
        <div class="play-menu play-flow-menu" role="menu" hidden></div>
        <div class="play-toast" role="status" hidden>Press Ctrl+\\ to show the toolbar</div>
        <div class="play-mode-label" role="status" hidden></div>
    `;
    const viewport = overlay.querySelector('.play-viewport');
    const sizer = overlay.querySelector('.play-sizer');
    const stage = overlay.querySelector('.play-stage');
    const counter = overlay.querySelector('.play-counter');
    const badge = overlay.querySelector('.play-badge');
    const toast = overlay.querySelector('.play-toast');
    const modeLabel = overlay.querySelector('.play-mode-label');
    const viewMenu = overlay.querySelector('.play-view-menu');
    const flowMenu = overlay.querySelector('.play-flow-menu');
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-play', '');
    document.head.append(styleEl);
    document.body.append(overlay);
    const resizeObserver = new ResizeObserver(() => onResize());
    resizeObserver.observe(viewport);

    /**
     * A descriptor as a DOM element. Elements of a node listen to its mouse events; the player decides what they do. A disabled layer,
     * and the scrollbar of a scrolling layer, trigger nothing.
     * @param {any} desc
     * @param {any[]} ancestors the descriptors this one sits in, outermost first
     * @returns {HTMLElement}
     */
    function mount(desc, ancestors = []) {
        const el = document.createElement(desc.tag);
        for (const [key, value] of Object.entries(desc.attrs ?? {})) {
            if (value === true) el.setAttribute(key, '');
            else if (value !== false && value !== undefined) el.setAttribute(key, String(value));
        }
        Object.assign(el.style, desc.style ?? {});
        if (desc.text !== undefined) el.textContent = desc.text;
        if (desc.html !== undefined) el.innerHTML = desc.html;
        if (desc.nodeId) {
            el.dataset.nodeId = desc.nodeId;
            if (ctx.interactionsOf(desc.nodeId).length) el.classList.add('play-hotspot');
            for (const type of ['click', 'mouseenter', 'mouseleave', 'mousedown', 'mouseup']) {
                el.addEventListener(type, e => {
                    // A click reaches every layer on its path: only the innermost layer under the pointer answers.
                    if (e.target.closest?.('[data-node-id]') !== el)
                        return;
                    if (isDisabledTarget(desc, ancestors) || onScrollbar(el, e))
                        return;
                    const event = eventFromDom(type, desc.nodeId);
                    if (!event) return;
                    const triggered = dispatch(event);
                    if (press && ['click', 'mousedown', 'mouseup'].includes(type)) press.triggered ||= triggered;
                });
            }
        }
        for (const child of desc.children ?? []) el.append(mount(child, [...ancestors, desc]));
        return el;
    }

    /**
     * Draws a frame at the current view mode. A moving or dissolving transition starts the entering frame from its `from` style and
     * clears it, so the CSS transition runs; the frame it replaces is removed when the transition ends.
     * @param {string} id
     * @param {any} transition
     */
    function renderFrame(id, transition) {
        const { root, styles, unsupported, problems } = toDomTree(data, id, { responsive: prefs.mode === 'responsive' });
        frameId = id;
        styleEl.textContent = styles ?? '';
        badge.hidden = !unsupported.length && !problems.length;
        badge.textContent = problems.length
            ? `Cannot draw this frame: ${problems.map(p => p.reason ?? p.dimension ?? p.state ?? 'problem').join(', ')}`
            : `${unsupported.length} layer${unsupported.length === 1 ? '' : 's'} not drawn`;
        badge.title = badge.textContent;
        updateControls();
        if (!root) return;
        const next = mount(root);
        next.classList.add('play-frame');
        next.dataset.frame = id;
        const old = stage.firstElementChild;
        const css = transition ? transitionCss(transition) : null;
        if (old && css && css.durationMs > 0) {
            next.style.transition = `transform ${css.durationMs}ms ${css.easing}, opacity ${css.durationMs}ms ${css.easing}`;
            Object.assign(next.style, css.from ?? {});
            stage.append(next);
            const done = setTimeout(() => {
                old.remove();
                transitions.delete(done);
            }, css.durationMs);
            transitions.add(done);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                for (const key of Object.keys(css.from ?? {})) next.style[key] = '';
            }));
        }
        else {
            stage.replaceChildren(next);
        }
        layout();
    }

    /**
     * Places the stage for the view mode. Responsive gives the frame the window; the other modes draw the frame at its size, scaled and
     * placed by `viewportLayout`. The sizer is as large as the drawn frame, so the window scrolls to it.
     */
    function layout() {
        const frame = nodeById.get(frameId);
        if (!frame) return;
        const vw = viewport.clientWidth, vh = viewport.clientHeight;
        lastWidth = vw;
        lastHeight = vh;
        const responsive = prefs.mode === 'responsive';
        viewport.style.overflow = responsive ? 'hidden' : 'auto';
        const box = responsive ? { width: vw, height: vh } : { width: frame.w, height: frame.h };
        const placed = viewportLayout({ viewport: { width: vw, height: vh }, frame: box, mode: prefs.mode });
        sizer.style.width = `${Math.max(vw, placed.width)}px`;
        sizer.style.height = `${Math.max(vh, placed.height)}px`;
        Object.assign(stage.style, {
            left: `${placed.offsetX}px`, top: `${placed.offsetY}px`, width: `${box.width}px`, height: `${box.height}px`,
            transformOrigin: '0 0', transform: placed.scale === 1 ? '' : `scale(${placed.scale})`,
        });
    }

    /** Previous and next, and the counter, follow the frame on screen. */
    function updateControls() {
        const step = stepFrame(pageFrames, frameId, 'next');
        counter.textContent = step.index < 0 ? `– / ${step.total}` : `${step.index + 1} / ${step.total}`;
        overlay.querySelector('[data-step="prev"]').disabled = stepFrame(pageFrames, frameId, 'prev').prevDisabled;
        overlay.querySelector('[data-step="next"]').disabled = step.nextDisabled;
    }

    /** The window was resized. A frame that follows the window, or a scaled one, is drawn again. */
    function onResize() {
        if (viewport.clientWidth !== lastWidth || viewport.clientHeight !== lastHeight) layout();
    }

    /**
     * Runs what the player decided: navigates, opens links, and schedules or clears the timers of the frame it lands on.
     * @param {{ state: any, effects: any[] }} result
     */
    function apply({ state: next, effects }) {
        state = next;
        const navigation = effects.find(e => e.type === 'navigate');
        if (navigation) {
            for (const t of timers.values()) clearTimeout(t);
            timers.clear();
            renderFrame(navigation.to, navigation.transition);
        }
        for (const e of effects) {
            if (e.type === 'open-link') window.open(e.url, '_blank', 'noopener');
        }
        for (const t of timersFor(effects)) {
            timers.set(t.key, setTimeout(() => {
                timers.delete(t.key);
                dispatch({ type: 'timer', nodeId: t.nodeId, interactionId: t.interactionId });
            }, t.delayMs));
        }
    }

    /**
     * Sends one event to the player. Returns whether it triggered anything (a navigation, a link, a timer or a while-end).
     * @param {any} event
     * @returns {boolean}
     */
    function dispatch(event) {
        const result = respond(state, event, ctx);
        apply(result);
        return result.effects.length > 0;
    }

    /** Restart goes back to the flow's start frame. The scroll position follows the Reset on restart setting. */
    function restart() {
        dispatch({ type: 'restart', startFrameId: flowStart });
        if (prefs.resetOnRestart) viewport.scrollTop = 0;
    }

    /** Puts a chrome state on screen. The class hides the top bar and the bottom controls with visibility, so they take no clicks or focus. */
    function applyChrome(next) {
        chrome = next;
        overlay.classList.toggle('chrome-hidden', !chrome.visible);
    }

    /**
     * Pins the chrome hidden, or shows it again. The first pin in a Play session says how to bring it back, for a few seconds.
     */
    function togglePinned() {
        if (menu !== null) openMenu(null);
        const wasPinned = chrome.pinnedHidden;
        applyChrome(chromeVisibility(chrome, { type: 'toggle-pinned' }));
        if (!wasPinned && chrome.pinnedHidden && !toastShown) {
            toastShown = true;
            toast.hidden = false;
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
        }
    }

    /** The pointer moves: in the top edge zone the chrome shows. The zone is a position, not an element, so it blocks nothing. */
    function onPointerMove(e) {
        applyChrome(chromeVisibility(chrome, { type: 'pointer', y: e.clientY }));
    }

    /**
     * Records what a press is on, when it starts. A press with a menu open first closes the menu: that click keeps the chrome.
     * @param {PointerEvent} e
     */
    function onPointerDown(e) {
        if (menu !== null && !e.target.closest('.play-menu') && !e.target.closest('[aria-haspopup]')) {
            openMenu(null);
            press = { kind: 'chrome', triggered: false };
            return;
        }
        press = { kind: pressKind(e), triggered: false };
    }

    /**
     * What a press is on: the chrome or a menu, a scrollbar, a disabled layer, a Button, another layer, or an empty part of the window.
     * @param {PointerEvent} e
     */
    function pressKind(e) {
        const target = e.target;
        if (target.closest('.play-topbar, .play-bottom, .play-menu, .play-toast, .play-mode-label')) return 'chrome';
        const owner = target.closest('[data-node-id]');
        if (!owner) return 'empty';
        if (onScrollbar(owner, e)) return 'scroll';
        if (target.closest('[aria-disabled="true"]')) return 'disabled';
        return owner.tagName === 'BUTTON' ? 'button' : 'node';
    }

    /** Ends the press: the chrome hides when the press triggered nothing and was on an area that does nothing. */
    function finishPress() {
        if (!press) return;
        applyChrome(chromeVisibility(chrome, { type: 'click', target: press.kind, triggered: press.triggered }));
        press = null;
    }

    /** A disabled element never fires click, so a press on it ends at pointer up. */
    function onPointerUp() {
        if (press?.kind === 'disabled') finishPress();
    }

    /** @param {'view' | 'flow' | null} which */
    function openMenu(which) {
        menu = which;
        viewMenu.hidden = which !== 'view';
        flowMenu.hidden = which !== 'flow';
        if (which === 'view') renderViewMenu();
        if (which === 'flow') renderFlowMenu();
        applyChrome(chromeVisibility(chrome, { type: 'menu', open: which !== null }));
    }

    function renderViewMenu() {
        const item = mode => `<button type="button" role="menuitemradio" aria-checked="${prefs.mode === mode}" data-mode="${mode}"><span class="play-check">${prefs.mode === mode ? '✓' : ''}</span>${MODE_LABELS[mode]}</button>${mode === 'responsive' ? `<div class="play-menu-note">${RESPONSIVE_NOTE}</div>` : ''}`;
        viewMenu.innerHTML = `
            <div class="play-menu-heading">Scaling <span class="play-shortcut">Z</span></div>
            ${SCALING_MODES.map(item).join('')}
            <div class="play-menu-heading">Advanced settings</div>
            <label class="play-menu-row">Viewport background <input type="color" data-background value="${prefs.background}"></label>
            <label class="play-menu-row"><input type="checkbox" data-hotspots ${prefs.hotspots ? 'checked' : ''}> Show hotspot hints</label>
            <label class="play-menu-row"><input type="checkbox" data-reset ${prefs.resetOnRestart ? 'checked' : ''}> Reset on restart</label>
            <div class="play-menu-separator"></div>
            <button type="button" role="menuitem" data-hide-ui>Hide UI<span class="play-shortcut">Ctrl+\\</span></button>
        `;
    }

    function renderFlowMenu() {
        const choices = flows.length ? flows : [{ id: 'start', name: nodeById.get(flowStart)?.name ?? 'Start', startFrameId: flowStart }];
        flowMenu.innerHTML = choices.map(f => `<button type="button" role="menuitemradio" aria-checked="${f.startFrameId === flowStart}" data-flow="${f.startFrameId}">${escapeText(f.name)}</button>`).join('');
    }

    /**
     * Sets the view mode: saved, drawn again, and the menu's checkmark follows if it is open.
     * @param {string} mode
     */
    function setMode(mode) {
        prefs.mode = mode;
        savePlayPrefs(prefs);
        renderFrame(frameId, null);
        if (menu === 'view') renderViewMenu();
    }

    /** Z moves to the next view mode, and names it for a moment. */
    function cycleMode() {
        setMode(nextScalingMode(prefs.mode));
        modeLabel.textContent = MODE_LABELS[prefs.mode];
        modeLabel.hidden = false;
        clearTimeout(labelTimer);
        labelTimer = setTimeout(() => { modeLabel.hidden = true; }, MODE_LABEL_MS);
    }

    /** @param {MouseEvent} e */
    function onMenuClick(e) {
        const mode = e.target.closest('[data-mode]');
        if (mode) {
            setMode(mode.dataset.mode);
            return;
        }
        if (e.target.closest('[data-hide-ui]')) {
            togglePinned();
            return;
        }
        const flow = e.target.closest('[data-flow]');
        if (flow) {
            flowStart = flow.dataset.flow;
            openMenu(null);
            restart();
        }
    }

    /** A key typed into a field (the background colour, a checkbox) is not a shortcut. */
    const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

    /** @param {KeyboardEvent} e */
    function onKey(e) {
        // The editor's own shortcuts (Delete, arrows, ...) must not act on the document while Play is open.
        e.stopPropagation();
        if (e.key === 'Shift') overlay.classList.add('hotspots-held');
        if (e.key === 'Escape') {
            if (menu !== null) openMenu(null);
            else close();
            return;
        }
        if (e.ctrlKey && e.key === '\\') {
            e.preventDefault();
            togglePinned();
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
        if (e.key === 'r' || e.key === 'R') restart();
        if (e.key === 'z' || e.key === 'Z') cycleMode();
    }

    /** @param {KeyboardEvent} e */
    function onKeyUp(e) {
        if (e.key === 'Shift') overlay.classList.remove('hotspots-held');
    }

    overlay.addEventListener('pointerdown', onPointerDown, true);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('click', e => {
        // A key press (Enter on a focused control) is a click with no pointer: it is not a press the chrome judges.
        if (e.detail === 0) press = null;
        finishPress();
        const step = e.target.closest('[data-step]');
        if (step && !step.disabled) {
            const { target } = stepFrame(pageFrames, frameId, step.dataset.step);
            if (target) dispatch({ type: 'navigate', frameId: target });
            return;
        }
        if (e.target.closest('[data-restart]')) return restart();
        if (e.target.closest('.play-flow-button')) return openMenu(menu === 'flow' ? null : 'flow');
        if (e.target.closest('[aria-label="View options"]')) return openMenu(menu === 'view' ? null : 'view');
        if (e.target.closest('[aria-label="Full screen"]')) {
            if (document.fullscreenElement) document.exitFullscreen?.();
            else overlay.requestFullscreen?.();
            return;
        }
        if (e.target.closest('[aria-label="Close (Esc)"]')) return close();
        if (e.target.closest('.play-menu')) return onMenuClick(e);
    });
    overlay.addEventListener('change', e => {
        if (e.target.matches('[data-background]')) {
            prefs.background = e.target.value;
            overlay.style.background = prefs.background;
        }
        else if (e.target.matches('[data-hotspots]')) prefs.hotspots = e.target.checked;
        else if (e.target.matches('[data-reset]')) prefs.resetOnRestart = e.target.checked;
        else return;
        savePlayPrefs(prefs);
        overlay.classList.toggle('hotspots-on', prefs.hotspots);
    });
    overlay.classList.toggle('hotspots-on', prefs.hotspots);

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('pointermove', onPointerMove, true);

    /** Closes Play: removes the overlay and its style, and cancels every timer and transition. The document is not touched. */
    function close() {
        if (!overlay.isConnected) return;
        for (const t of timers.values()) clearTimeout(t);
        timers.clear();
        for (const t of transitions) clearTimeout(t);
        transitions.clear();
        clearTimeout(toastTimer);
        clearTimeout(labelTimer);
        resizeObserver.disconnect();
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('keyup', onKeyUp, true);
        document.removeEventListener('pointermove', onPointerMove, true);
        if (document.fullscreenElement) document.exitFullscreen?.();
        overlay.remove();
        styleEl.remove();
    }

    renderFrame(startFrameId, null);
    return close;
}
