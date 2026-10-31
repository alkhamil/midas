// The antd click wave, shared runtime. A click on a wave host toggles the data-wave-on attribute; the ::after ring
// (spread and fade keyframes in the generated stylesheet) plays once, and animationend removes the attribute so the
// next click restarts it. No wave when disabled. Keyboard activation fires click natively, like antd. The restart is
// synchronous (attribute off, forced reflow, attribute on), so the lifecycle is testable without a DOM.
const WAVE_KEYFRAMES = 'midas-wave';

/**
 * Shows one wave on a host element carrying data-wave.
 * @param {{ disabled?: boolean, closest?: (sel: string) => unknown, removeAttribute: (name: string) => void, setAttribute: (name: string, value: string) => void, offsetWidth: number, addEventListener: (type: string, fn: (e: any) => void, opts?: any) => void }} host
 * @returns {boolean} whether a wave started
 */
export function showWave(host) {
    if (!host || host.disabled || host.closest?.(':disabled')) return false;
    host.removeAttribute('data-wave-on');
    void host.offsetWidth;
    host.setAttribute('data-wave-on', '');
    host.addEventListener('animationend', e => {
        if (e?.animationName === WAVE_KEYFRAMES) host.removeAttribute('data-wave-on');
    }, { once: true });
    return true;
}
