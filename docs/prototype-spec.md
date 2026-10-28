# Prototype spec

Source of truth for the Prototype feature (phase 1: Figma-style interactions and a DOM Play preview). Behavior rules live in
`docs/behavior-spec.md`; the two share the load rules in `AGENTS.md`.

## Data

- `node.prototype = { version: 1, interactions: [{ id, trigger, action }], overflow? }` on the source node. An instance may own interactions. A managed layer may not. `overflow` is `none` (the default, not stored), `horizontal`, `vertical` or `both`, and only a frame may have it.
- `trigger` is `{ type }`, or `{ type: 'after-delay', delayMs }` with a whole `delayMs` above zero.
- `action` is `{ type: 'navigate-to', destinationId, transition }`, `{ type: 'back' }`, or `{ type: 'open-link', url }` (http and https only).
- `transition` is `{ type, durationMs, direction?, easing? }`. `slide-in` and `push` need a direction. `instant` and `dissolve` take none.
- `page.prototype = { version: 1, flows: [{ id, name, startFrameId }] }`. A flow starts at a top-level frame.
- A destination is any top-level frame on any page, including a top-level instance or master.
- New action types (overlay, dropdown, conditional, variables) are added to `ACTION_TYPES` with their own fields. The structure does not change.

## Load rules

- A file with no prototype data opens normally. A different version, an unknown field, or a shape error fails with an explicit error naming the page and the node.
- Eager open validates the whole file. Lazy open validates each page as it arrives with `complete: false`: a reference to a page that has not arrived yet is deferred, and checked when that page arrives.
- A failing lazily loaded page stays an empty stub and is never written back.
- Validation returns `{ code, page, node, interaction, message }` for every problem. The codes are listed in `packages/builder-core/src/prototype/validate.js`.

## Decisions

1. `navigate-to` and `back` cannot run on `while-hovering` or `while-pressing`. The validator reports `trigger-action-mismatch`. `open-link` can. Other actions come later.
2. Save waits while any page is still loading (the editor's existing lazy-page wait), and is blocked by the first prototype problem in the document. The toast names the page and the node. `saveBlockedBy` decides the second part.
3. Deleting a node removes the interactions that point at it and the flows whose start is that node. Both are reported in a toast. No flow is left dangling.
4. Detaching an instance keeps the instance's own interactions. Interactions on master-owned inner layers and on managed layers are dropped and reported.
5. Play never writes to the document or its history. It reads the document, and its state lives only in the overlay.
6. Scroll behaviour is rejected on template instances: the validator reports `overflow-on-instance`, naming the page and the node. The Prototype tab hides the Scroll behavior section for an instance, and Play ignores any overflow it finds on one (it clips on both axes).
7. The `fill-screen` migration stays. It maps a value in the browser's `midas.play` preference (`resolveScalingMode`), not document data, so the no-legacy rule does not apply. The preference was written by an earlier build of Play, and a user who saved it should keep the view they chose.
8. Constraints are not in the data model. Children of a plain frame stay absolutely positioned at their x and y and do not stretch in Responsive mode; only auto layout frames adapt. This is a known limitation, not a bug. The view menu says so under Responsive. Constraints are not implemented here.
9. Fidelity rule: the canvas is the source of truth for what a layer looks like. Any geometry the DOM preview needs is computed by one shared module, never duplicated in the DOM renderer. A property the DOM cannot match is reported in the toolbar badge, never drawn silently.

## Play

- Play starts at the first flow of the active page, else the selected top-level frame, else the first top-level frame (`playStartOf`).
- A frame is drawn as DOM from `toDomTree`. A Button instance is the same `<button>` the codegen exports, styled by the codegen CSS, which is injected once per Play session. So `:hover`, `:active`, `:focus` and `:disabled` are live.
- Mouse events on a node go to the player (`eventFromDom`, then `respond`). `schedule` effects become timers; a timer is cleared on a frame change and on exit.
- Transitions: `transitionCss` gives the duration, the easing, and the starting state of the entering frame.
- Layers the DOM does not draw are counted in the toolbar, not dropped silently.
- The frame is drawn at the scaling mode set in the view menu (see Play viewer). There is no zoom step.
- Esc exits. Alt+Enter opens Play when no other Play is open (Alt+Enter was free).

## Play viewer (Figma-style)

- Dark top bar: the file name with a flow selector, a view-options button (sliders), a full-screen toggle and a close control. Esc closes the open menu first, then Play.
- Bottom centre pill: previous and next frame, with an "n / total" counter. The frames are the top-level frames of the flow's page in order (`flowFrames`). Previous and next dispatch a `navigate` event to the player, so they are history steps and Back returns to the frame before. Both are disabled at the ends.
- Bottom right: Restart, shown with the R key (R restarts, with the menu open or closed). Restart resets the scroll position when "Reset on restart" is on.
- Disabled layers: a disabled Button, and every layer inside it, triggers no pointer interaction (on-click, mouse enter, leave, down and up, while hovering, while pressing). Chromium does not dispatch click, mouse down or mouse up to a disabled button, but it does dispatch mouse enter and leave, so the Play listeners check `isDisabledTarget` before they call the player. After-delay is not pointer driven and stays active. A disabled Button has `disabled`, `aria-disabled="true"` and the `not-allowed` cursor.
- Chrome (`chromeVisibility`, pure): a click on an empty area, on a node with no interaction, or on a disabled element hides the top bar and the bottom controls. A click that triggers an interaction, a Button, a scrollbar, the chrome or the menu does not. The pointer in the top 48 px shows the chrome again; the pointer elsewhere does not. The chrome has no timer. Hidden chrome is `visibility: hidden`, so it takes no clicks or focus, and the top edge is a position, not an element, so it blocks nothing.
- Ctrl+\ pins the chrome hidden (`pinnedHidden`). While pinned it never shows: not at the top edge, not on a click, not with a menu. The first pin in a Play session shows the toast "Press Ctrl+\ to show the toolbar" for three seconds. Ctrl+\ again shows the chrome. The view menu's Hide UI does the same.
- View menu: a "Scaling" group whose header carries the Z hint, then Actual size (100%), Responsive, Fit width and Fit width and height. Advanced settings: the viewport background, Show hotspot hints (also held with Shift) and Reset on restart.
- Z cycles the scaling mode (`nextScalingMode`): Actual size, Responsive, Fit width, Fit width and height, then Actual size again. It works with the menu open, the checkmark follows, and the new mode's name shows for one second. Z and R do nothing while a field has focus. An unknown mode counts as Actual size, so Z from it goes to Responsive.
- Scaling (`viewportLayout`, pure): Actual size is 1:1 and centred; the page scrolls on the axes the frame overflows. Responsive gives the frame the window size at scale 1: the top-level frame's width and height follow the window, the window never scrolls, and the frame's own Scroll behaviour decides what scrolls inside it. Fit width scales the frame to the window width and scrolls vertically when taller. Fit width and height contains the frame, centred, and never scrolls.
- Responsive: `toDomTree(doc, id, { responsive: true })` gives the top-level frame 100% width and height. A child's sizing is per axis, on the parent's main axis (its flow direction) and its cross axis (`flowSizing`): fill takes the free space on the main axis and stretches on the cross axis; hug and fixed keep their size and do not shrink, so a child wider than its frame is clipped by the frame, unless the frame's Scroll behaviour opens that axis. Absolutely positioned children keep their x, y and size.
- Scroll behaviour (Overflow): `node.prototype.overflow` on a frame, one of `none` (the default, not stored), `horizontal`, `vertical` or `both`. The frame's `overflow-x` and `overflow-y` open the named axes and clip the others, for top-level and nested frames alike. A press on a scrollbar triggers nothing. The Prototype tab shows a warning icon, with the tooltip "For scrolling to work on this frame, the content needs to be bigger than the frame.", when the content does not reach past the frame on a chosen axis (`overflowWarning`).
- The view settings are kept in the browser (localStorage key `midas.play`), never in the document or its history. A stored `fill-screen` becomes Fit width and height; an unknown or empty value becomes Actual size (`resolveScalingMode`). A missing value keeps the default.

### Known limitations

- Midas has no constraints (left, right, centre, stretch) in the data model. An absolutely positioned child keeps its x, y and fixed size in responsive mode; it does not follow the frame width. Implement constraints first, then map them in `toDomTree`.
- A click on a child layer does not reach its parent's on-click (the innermost layer answers). Separate defect, not fixed in this pass.
- The overflow warning uses the children's stored x, y, w and h. It does not model auto layout gaps or padding.
- Every frame clips by default. The `clip` flag of a frame no longer decides clipping.

## Not in phase 1

- Connection handle, connector arrows and the flow-start marker on the canvas.
- Flow creation from the panel (a flow exists only in the file for now).
- Copy, paste and duplicate wiring of interactions. The copy planner (`planCopiedInteractions`) was removed as unused; re-add it with the wiring.
- Rolling back a prototype problem with a "Not applied" message (the editor does not yet run the prototype check as a backstop).
- Marking a flow start from the panel and showing the flow-start marker on the canvas.
- The canvas draws no Play state; the Canvas 2D fallback is not involved.

## Status

Phase 1 pure core and the editor wiring listed in `docs/manual-test.md` are in. The items under "Not in phase 1" are not built. Known debt from review: the top-level frame rule is still spelled in validate.js and dom-tree.js as well as play.js; the managed-layer check repeats the `slot` test in three places; the Play listener list is spelled in play.js and events.js.

Round 2 (disabled layers, scaling modes, chrome visibility, Scroll behaviour) is built and checked in `docs/manual-test.md`. Known debt from review, still open: the top-level frame rule is spelled in validate.js and dom-tree.js as well as play.js; a click on a child layer does not reach its parent's on-click; the constraints model is missing.

Round 3 (fidelity and chrome) is in: a text layer draws its fill as its text colour, with no box, and rich text draws one span per style run; a template instance is refused a scroll behaviour, and Play ignores one; the overflow warning ignores hidden children and reports each axis; the bottom bar pins the pill to the centre column and Restart to the right; the Responsive menu says what it adapts. Not done, and the DOM preview still lists these as not drawn or drawn wrong: lines, paths, polygons, stars, vectors, boolean results, masks, image layers, image fills, gradients other than linear, per-corner radius, inside and outside stroke alignment, dashes, text stroke, text shadow, text truncation, effects other than the legacy drop shadow, blend modes, and arc and donut ellipses. Round 4 moved the geometry into builder-core (see below). A pixel parity pass between the canvas and Play has not been run.

Decision: a text layer with no fill draws nothing, in Play as on the canvas (`colour: transparent`). The canvas is the source of truth; no default colour is used.

Round 4 (geometry and fidelity): the outline, stroke and fill code the canvas uses moved into `builder-core/src/geometry/` (`shapes.js`, `fills.js`). The canvas builds its Path2D from the shared commands, and the DOM preview emits SVG from the same commands, so one geometry serves both. Play now draws arcs, donuts, lines, vector paths, centred, inside, outside and dashed strokes, per-corner radii, flips, multiple fills, linear, radial and angular gradients, drop and inner shadows, layer and background blur, text stroke, glyph shadow and truncation. Fidelity fixture: `scripts/make-fidelity-fixture.js`, one frame per feature.

Fidelity, checked in Play at Actual size (1280 wide). The canvas was not compared row by row at 1:1, so a row marked OK is OK in Play as a visual check against the expected look:
- OK: solid, fill opacity, text in a plain frame (no box), rich spans, text stroke, text drop shadow, truncation, balanced wrap, short hex with alpha, linear 0 and 45 degrees, radial, angular, multiple fills (olive from yellow at 60% over blue), per-corner radius, centred, inside, outside and dashed strokes, full ellipse, 75% arc, donut, line, closed vector path, curved vector path, drop shadow, layer blur, flip and rotation, opacity, group with clip content.
- Looks right but not checked closely: per-side stroke, inner shadow, background blur (the layer behind is one flat colour, so the blur barely shows), truncation line count.
- WRONG: boolean union and subtract (both operands are drawn, not the result); mask (the mask shows as a solid shape instead of clipping the layer below it).
- Flagged, not drawn: image layer, glass. Both are counted in the toolbar badge.

Known gap, not reproduced in the fixtures: a click on a child layer of a clickable parent (see Known limitations).

Legacy shadow: the canvas still reads `node.shadow` (the old flag) when a layer has no effects list (`getEffects` in midas.js). Play does not read it. A file that has only the old flag draws its shadow on the canvas and not in Play. Open question: remove the old flag from the canvas too.

Untitled file: a file opened on a page other than its master's page failed to open and was replaced by an Untitled file. The cause: the boot open parsed the saved file as complete, so a master on a page not yet loaded (a stub) was refused. The boot now parses with the partial check when pages are still pending, the same as the streamed open does. Fixed in `apps/studio/src/engine/midas.js`; the contract is pinned by `builder-core/test/behavior-lazy-open.test.js`.
