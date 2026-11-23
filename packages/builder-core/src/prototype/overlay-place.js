// Overlay placement (pure). Where an open overlay's frame sits inside the frame it covers, in the frame's own units (before the view scale).
// `center` centres it; `below` and `above` put it against the trigger's layer, left edges aligned, with a gap between them. The runtime
// measures the trigger's box and the stage; the model holds only the placement name (decision 16 of docs/prototype-spec.md).

/** The gap between a trigger and an overlay placed below or above it, in frame units. */
export const OVERLAY_GAP = 8;

/**
 * The top-left corner of an overlay frame. The result stays inside the stage when the overlay fits in it; a larger overlay sits at the stage's edge.
 * @param {{ placement: string, overlay: { w: number, h: number }, stage: { w: number, h: number }, anchor?: { x: number, y: number, w: number, h: number } | null }} input
 * @returns {{ x: number, y: number }}
 */
export function overlayPlacement({ placement, overlay, stage, anchor }) {
    let x = (stage.w - overlay.w) / 2;
    let y = (stage.h - overlay.h) / 2;
    if (placement !== 'center' && anchor) {
        x = anchor.x;
        y = placement === 'above' ? anchor.y - overlay.h - OVERLAY_GAP : anchor.y + anchor.h + OVERLAY_GAP;
    }
    return { x: clamp(x, stage.w - overlay.w), y: clamp(y, stage.h - overlay.h) };
}

/** Keeps a position at or after 0, and at or before `max` (0 when the overlay is larger than the stage). @param {number} value @param {number} max */
const clamp = (value, max) => Math.min(Math.max(0, value), Math.max(0, max));
