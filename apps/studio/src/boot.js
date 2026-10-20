// Progress of the start-up, shown by the start screen. Stages report how far they are; the number never goes back.
const subs = new Set();
let pct = 0, label = 'Starting Midas';
export const boot = {
    /** Move the bar to `p` (0-100) at the latest; the label is optional. */
    set(p, text) {
        if (p > pct)
            pct = Math.min(100, p);
        if (text)
            label = text;
        subs.forEach(f => f(pct, label));
    },
    /** Same, then give the browser a moment to paint it (the work that follows can block the page for a while). */
    async step(p, text) {
        this.set(p, text);
        await new Promise(r => { requestAnimationFrame(() => setTimeout(r, 0)); setTimeout(r, 60); });
    },
    get() { return { pct, label }; },
    subscribe(f) { subs.add(f); f(pct, label); return () => subs.delete(f); },
};
