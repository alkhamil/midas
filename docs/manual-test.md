# Behavior manual test

Run once, top to bottom. Highest risk first. Anything marked **expected (from code)** is what the code produces but has not been seen in the editor yet; record what you actually see.

## Setup

1. Generate the fixtures:

   ```bash
   node scripts/make-behavior-fixture.js
   ```

   This writes `scripts/fixtures/behavior-fixture.midas` (the document) and `scripts/fixtures/managed-layer-clipboard.json` (a clipboard payload).

2. Open the document: on the home screen choose **Import file** and pick `behavior-fixture.midas`. Expected toast: `Opened Behavior fixture`. The import is stored on the server (`POST /api/files/import`).
3. Lazy open: go to **All files** and open **Behavior fixture** from the list. The page requests `Screens`, `Empty 3`, `Empty 4` and `Empty 5` one at a time (`GET .../pages/page-…`), which is the lazy path.

Console noise that is not a failure: repeated `WebSocket connection to 'ws://localhost:5174/' failed` lines come from the Vite hot-reload socket in dev. The editor must log no `Not applied`, `Cannot open` or `could not be loaded` message.

Fixture objects:

| Page | Object | What it is |
|---|---|---|
| Components | **Button** (`main`) | Master, bound to Button. Variant = "Variant", Size = "Size". |
| Components | **Save** (`inst-start`) | Instance of Button. Variant Primary, Size Small, Has Icon on, placement start. |
| Components | **Cancel** (`inst-plain`) | Instance of Button. Variant Danger, Size Large, Has Icon off. |
| Components | **Unbound** | Master, no template. Collections Variant and Size exist. |
| Components | **Button (legacy)** | Master, bound to Button with "Variant B". Danger has no hover token. |
| Screens | **Next** (`inst-cross`) | Instance of the Button master on the Components page. Has Icon on, placement end. |
| Empty 3, 4, 5 | (none) | Empty pages, so the file has more than three pages. |

Clipboard file: `scripts/fixtures/managed-layer-clipboard.json`. Its one layer is named **iconStart**.

## Steps

1. **Lazy open is clean.** Open the file from All files. All five pages load and the status reads "Saved".
   - Expected: no error toast. Every page appears in the Pages list.
   - If a page fails, the toast reads `Cannot open this file: behavior data on "<name>" (<id>) on page "<page>" is invalid: <problem>. This build reads behavior version 1.` That page stays empty and is never written back.

2. **Cross-page instance.** Open the Screens page and select **Next**. Open the Behavior tab.
   - Expected: Slots shows Has Icon on and Icon placement end. Diagnostics shows "No issues".

3. **Edit while pages load (only if the pages are still arriving).** Select a layer as soon as the file opens.
   - Expected toast, if you edit too early: `Still loading the pages of this file: you can look around now and edit when it is done.`

4. **Paste a managed layer alone.** Copy the text of `managed-layer-clipboard.json` to the system clipboard. On the canvas, press Ctrl+V.
   - Expected toast: `"iconStart" is managed by its instance: pasting it without that instance is not allowed.`
   - Expected: no layer is added.

5. **Copy a managed layer.** Select the **iconStart** layer inside **Save**, press Ctrl+C.
   - Expected toast: `"iconStart" is managed by its instance: copying it on its own is not allowed.`

6. **Paste a whole instance.** Select **Save** and press Ctrl+C, then Ctrl+V.
   - Expected: a copy of Save appears with its iconStart layer, and no toast. The copy is one undo step named "Paste layers".

7. **Auto-match on bind.** Select **Unbound**, open the Behavior tab, set Template to Button.
   - Expected: Variant and Size each show "Auto-matched" and select their collections. Variant B is not chosen.

8. **Auto-match on rename.** Select **Unbound** (bound to Button from step 7). Set its Variant row to None. In the Variables window rename "Variant" to "Colour", then rename it back to "Variant".
   - Expected: after renaming back, the Variant row shows "Auto-matched" again. While it is named "Colour" the row stays None.

9. **Duplicate names bind nothing.** With Unbound selected, set its Size row to None. In the Variables window create a second collection and rename it "Size".
   - Expected: the Size row stays None, with the empty state `No "Size" collection matched. Pick one.`
   - Delete the second "Size" collection afterwards.

10. **Diagnostics on the legacy master.** Select **Button (legacy)**, open the Behavior tab, scroll to Diagnostics.
    - Expected Error row: `Button (legacy): state "hover" needs token "bg-hover" in mode "Danger" (no-value-in-mode).`
    - Expected Code rows, one per size (**expected (from code)**): `Code: bg-hover in variant danger, size sm (no-value-in-mode).` and `Code: bg-hover in variant danger, size lg (no-value-in-mode).`
    - The Generate code button is disabled, and nothing downloads.

11. **Generate code on the main master.** Select **Button**, scroll to Code, click Generate code.
    - Expected: two downloads, `Button.jsx` and `Button.css`. The browser may ask once to allow multiple downloads.
    - Expected first line of `Button.jsx`: `export function Button({ variant, size, label = "Button", hasIcon = false, iconPlacement = "start", icon = null, loading = false, disabled = false, fullWidth = false, onClick, onHover, onFocus, onBlur }) {`

12. **Preview states, no document change.** Select **Save**. In Preview, set State to Default, Hover, Active, Disabled in turn. Read the `bg` row.
    - Expected (Primary, Small): Default `#4338ca`, Hover `#3730a3`, Active `#312e81`, Disabled `#a5b4fc`.
    - Select **Cancel** (Danger, Large) and set Hover: expected `bg` is `#b91c1c`.
    - Expected: changing the preview state adds no undo step. Ctrl+Z undoes the last document change, not the preview.
    - The canvas does not change. The canvas preview is not wired.

13. **Rollback message.** If a change ever leaves the file unable to open, the change is undone with `Not applied: "<name>" <problem>.` Watch for this during the other steps. The UI normally prevents it, so it may not appear.

14. **Canvas selection fix (commit f1fd440).** Click, double-click and Ctrl+click layers in nested frames. Confirm the selection goes to the layer you clicked.

## Known limits (not covered by this script)

- The Preview section shows token values only. Nothing is drawn on the canvas.
- Diagnostics are hidden until every page has loaded. Expect "Diagnostics appear when all pages are loaded." while the file is still opening.
- The studio has no zip export. Generate code downloads two files.
- Deep links to a page that is still loading can fall back to a new empty file. Seen once: `?page=page-screens&node-id=inst-cross` opened an "Untitled" file. Open other pages by clicking them in the Pages list instead.
- Smoke run (fixture opened by import and reopened from All files): the five pages, the named objects, and the legacy master's hover Error were all as described. The Save, Cancel, Next and main Button checks matched the step text.

## Behavior rework: browser checks (run on the regenerated fixture)

Run after `node scripts/make-behavior-fixture.js`, import the file, then check each line. Record what you see.

1. Variant and Size on Save: the Behavior panel changes the mode, the canvas follows, and the Design panel shows the same mode for the same layer (the mode lives on the instance root, `varModes`).
2. Disabled on Save: the root fill becomes `button/bg-disabled` and the label fill `button/fg-disabled`. Turn it off: both go back to `button/bg` and `button/fg`. One history step each. No `vars` override appears on the instance.
3. Label on Save: the label layer text follows the prop (saved as `text`).
4. Full Width on Save: the root width mode becomes Fill and goes back to Hug when off.
5. Undo after Full Width: exactly one step is reverted, and the label change stays.
6. Preview state Hover on Save: the badge reads "Previewing: Hover". The file is not changed (no history entry). Reload: no preview data is saved.
7. Cancel and the Card group: Cancel is not changed by the Save edits (apart from the bindings its own modes give it). Button never reads `card/bg` or `card/fg`.
8. Bind tokens on a master with unbound tokens: the button says how many are unbound, binds only the empty ones, and never overwrites an existing binding.
9. Diagnostics: the legacy master shows "variable ... has no value in mode Danger" as an error. A layer set by hand while disabled shows a warning. Loading shows a Note.

Known and fixed (decision 1): a bound lineHeight variable is px. The editor's field is still the ratio px / font size; a value under 4 is an error. Fixture values such as 1.4 therefore draw a 2 px label. See the open questions in the report.

## Open items from the rework

- WebGPU "TextureView ... cannot be used with [Device]" (console error, status bar "WebGPU validation error"). Not reproduced on a clean HEAD worktree (3 full reloads, same Disabled and Variant steps, fresh fixture import) or on the rework (3 clean runs). It appeared once in a tab whose modules had been hot-replaced (stack frames with `?t=` URLs), together with a TypeError in `DocumentModel.touch`. Treat it as a stale hot-reload state until it recurs in a fresh tab: reload the tab, and if it shows again, note the steps and the console output.
- Override detection and copy skip layout-owned geometry: `isLayoutOwnedField` (`instance-vars.js`). A flow child of an auto-layout parent keeps its x and y from layout; a child sized hug (or fill in a frame) keeps that axis from layout. Absolutely positioned children and fixed sizes are still copied. Not covered by a browser check on a non-Button master resize (see the smoke results).
- The canvas preview draws the root background and border only, in the GPU path. The Canvas 2D fallback does not draw the preview. The fixture's root has `strokeWidth: 0`, so Focus (border) shows no change on the canvas; set a stroke width on a copy to check it.
- Bound lineHeight variables are px. Values under 4 raise the line-height-looks-like-ratio error.

## Behavior rework: smoke results (fresh fixture, this pass)

Fixture imported through the home import; each check reads the saved document through the file API. Write counts are the change in node `version` between saves (one count per touch).

| Check | Result |
| --- | --- |
| Disabled on, Save (steady state, second cycle) | Save root +3, Save label +2, Cancel 0, no `overrides` |
| Disabled off, Save (steady state) | Save root +3, Save label +2, Cancel 0, no `overrides` |
| First Disabled toggle after import (includes the first full sync) | Save +5 and +4, Cancel +2 and +2 (a one-time sync of geometry); no `overrides` |
| Copy writes to x, y, w, h on Cancel (instrumented copy loop, removed afterwards) | 0 per toggle (before the layout rule: 2 on Cancel, 4 on its label, 6 changed in total per toggle) |
| hasIcon off, then on | Icon layer removed, then back at the start of the row |
| iconPlacement start to end | Icon moves after the label; label keeps its place |
| Variant change on Save (Appearance modes) | Save's mode changes to Primary; Cancel keeps Danger; no card variable changed; no node `vars` references `card/` items |
| Preview Hover on Save | Canvas draws the darker root background; text stays white; badge "Previewing: Hover"; no preview data in the saved document |
| Preview reset on selection change | Selecting Cancel shows "Default" in the Preview section; selecting Save again shows "Default" |
| Save and reopen | Preview is Default after reopen; Variant Primary is kept |
| Bind tokens on Button, all bound | The button reads "Bind tokens (all bound)"; no node's vars change |
| Bind tokens on an unbound master, existing bindings kept | Not run in the browser. Covered by `bind-tokens.test.js` (never overwrites existing keys). |
| Canvas Focus preview | Not visible on the fixture (stroke width 0). Covered by `canvasColorsOf` tests. |
| Kopi Kita (sample) master resize, nested instances, non-auto children | Not run. The master width could not be set to a fixed value through the Design panel in the time available: the W control is a Hug toggle. The sample has no nested instances and no non-auto-layout children, so the case table is partly covered by the tests. |

Kopi Kita was opened through a copy imported from `scripts/fixtures/sample-app.midas` (file id 464482ba-bb69-491e-a0fa-d50f6292df22), not the workspace file. Its Button master is on `page-components`; the 21 instances are spread over the pages. The workspace's own "Kopi Kita" file was not changed.

Test copies of the fixture and the sample are in the workspace (named "Behavior fixture" and "Kopi Kita"). Delete them from All files when the checks are done.

## Verification pass (after the code review)

Fresh import of `scripts/fixtures/behavior-fixture.midas` (the master root now has `strokeWidth: 2`). Reads go through the file API.

| Check | Result |
| --- | --- |
| Disabled on, Save, steady state | Save root +3, label +2; Cancel 0; no `overrides` |
| Disabled off, Save, steady state | Save root +3, label +2; Cancel 0; no `overrides` |
| Cancel copy writes to x/y/w/h | 0 (measured earlier with a removed copy-loop hook; not re-measured after the x-rule change) |
| Focus preview, Save | Preview shows "Previewing: Focus" and the border token row. The canvas border was not confirmed visually: at the zoom levels tried the 2 px stroke was too small to read, and one zoom step went past the frame. Not verified on the canvas. |
| Canvas 2D fallback | Not covered. The preview substitution is in the GPU `push()` only; `renderCanvas` does not read `canvasPreview`, so the fallback draws the instance's own colours. |
| Bind tokens on an unbound master | Not run in the browser. Covered by `bind-tokens.test.js`, which checks that existing keys are never overwritten. |
| Kopi Kita master resize (auto-layout children, fill children of a plain frame, absolute children, nested instances) | Not run. The sample has no nested instances and no non-auto-layout children, and the master width cannot be set to a fixed value from the Design panel without a further step. Covered by `isLayoutOwnedField` tests only. |

Canvas preview cost (pure lookup, Node, 20,000 calls for the small set and 5,000 for the large sets, 8 token items plus the size tokens in the base case):

| Variables in the document | Before the cache (per call) |
| --- | --- |
| 15 | 112 µs |
| 515 | 1,556 µs |
| 5,015 | 12,804 µs |

`canvasPreviewOf` now caches its result on the document revision, the selected instance and the preview state. A draw reuses the cached value; a write recomputes it once. The per-draw cost is then a string key and two comparisons. The in-browser draw time was not measured.

## Manual only (not covered by the automated suites)

These cannot be checked in Node. Run them in the browser on a fresh import, and record the result here.

- Focus border at high zoom: the stroke is 2 px on the fixture master; at 61% it is about 1 px, and the zoom steps tried either hid the frame or made the border too faint to read. Check at 200% or more with the Save instance in view.
- Canvas 2D fallback preview: the Hover/Active/Focus substitution is drawn only by the GPU `push()`. The fallback draws the instance's own colours. Expected: no substitution. Force the fallback (no WebGPU) and confirm the canvas does not change while a preview is selected.
- Bind tokens in the browser, on the Button master with unbound tokens: the button shows the unbound count, binds only the missing tokens, and never overwrites an existing binding. (`bind-tokens.test.js` covers the planner, not the editor.)
- Kopi Kita master resize in the browser: resize the master, then check that auto-layout children, fill children of a plain frame, absolute children and nested instances follow the master. The copy decision is covered by `copy-decision.test.js`; the layout that writes x/y/w/h is in `midas.js` and is not importable in Node.

## Prototype phase 1 (browser smoke, prototype fixture)

Fixture: `scripts/fixtures/prototype-fixture.midas` (import via the home screen). Signed in through the sign-in form.

| Check | Result |
| --- | --- |
| The file opens with its Flow page; the four frames draw on the canvas | Pass |
| Select Next, open the Prototype tab: trigger, action, destination, transition, direction, duration and easing fields | Pass |
| Add interaction on the Unavailable button saves one on-click navigate-to; Remove drops it and the `prototype` key | Pass |
| Play opens on Home from the toolbar button; Alt+Enter also opens it; Esc closes it | Pass |
| Primary, danger and disabled Buttons render with the codegen classes; the disabled one ignores clicks | Pass |
| Next (slide-in), Continue (push), Cancel (dissolve), Done: each navigates | Pass |
| Mouse-enter on Delete navigates to Confirm | Pass |
| After-delay on Back home returns to Home after 1.2 s | Pass |
| Zoom in doubles the stage; Fit returns to width | Pass (zoom only) |
| Play leaves the document unchanged: no node version changes | Pass |
| Back (back action) and Restart | Not run in the browser (the player tests cover them) |
| Open link, while-hovering and while-pressing in the browser | Not run (the player tests cover them) |
| Lazy open of a file with a broken prototype page | Not run in the browser (validator tests cover it) |
| Save blocked while a page is loading | Not run in the browser (`saveBlockedBy` tests cover it) |
| Delete of a flow start, detach of an instance with interactions | Not run in the browser (planner tests cover them) |
| Copy, paste and duplicate of interactions | Not wired |
| Connection handle, connector arrows, flow-start marker | Not built |

DOM against canvas for the Home frame:

- Button width: the DOM buttons hugged their content (72, 87 and 131 px) after the align-self fix. Before the fix they were stretched to the frame width.
- Button height: the DOM button is 43 px tall (codegen tokens). The fixture master is 48 px tall on the canvas. Not reconciled.
- Disabled colour: the canvas draws the Unavailable button in the primary colour, because the fixture's flow instances carry no variable bindings. The DOM draws it disabled, from the codegen CSS. A canvas-side mismatch, not a DOM bug.
- Label font: the canvas and the DOM both use Inter here. Not measured against each other pixel by pixel.

Known limits recorded during this pass:

- Opening a deep link to a lazily loaded page (for example `?page=page-flow` on a six-page file) can fall back to a new empty file. Open the file on its first page, then click the page.
- Each import of a fixture adds a file to the workspace. Delete the test copies from All files when done.

## Play viewer (Figma-style) browser smoke

Fixture: `scripts/fixtures/prototype-fixture.midas`, opened on its Components page, then its Flow page. Pane set to 800 x 600 for the screenshots, then reset to desktop.

| Check | Result |
| --- | --- |
| Play is an icon-only button, same height as Export; the avatar is a 28 px circle with an "A" and the name as its tooltip | Pass |
| Play opens from the icon; the counter shows 1 / 4 on Home | Pass |
| Chrome hides about 2.5 s after the last activity; a pointer move brings it back | Superseded by round 2: no timer; see below |
| View menu: Fit width and height checked; Responsive, Fit width, Fill screen and Actual size listed | Superseded by round 2: Fill screen is removed |
| Fit width and height contains the frame (scale 600 / 667 in a 600 px high window) | Pass |
| Responsive: the frame follows the window width (600 px window, frame 600 px) | Pass |
| Previous and next move through the four frames; disabled at each end | Pass |
| R restarts to Home, with the view menu open | Pass |
| Ctrl+ hides the chrome and shows the hint; Ctrl+ again shows it | Superseded by round 2: the hint is a one-time toast; see below |
| Flow selector lists the flow; choosing it restarts at its start | Pass |
| Esc closes the menu first, then Play; the injected style is removed | Pass |
| Actual size, Fit width, Fill screen | Superseded by round 2 (Fill screen is removed; the other modes are checked there) |
| Hotspot hints, Shift held, viewport background, Reset on restart | Not run in the browser |
| Hide UI from the menu | Not run in the browser (the Ctrl+ path is the same) |
| Nested after-delay, click on a child with a parent interaction | Not run in the browser (player and runtime fixes are in; tests cover the player) |

Known: the screenshots of the pane do not always match the element positions reported by the DOM (the pane's framing differs from the page), so positions were checked through the DOM, not only in the images.

## Play viewer: code review pass (fixes made, browser status)

Fixed after the two review axes: mouse-leave interactions now run (a unit test covers it); a height-only resize re-fits the frame; hidden chrome no longer takes clicks; the editor's own shortcuts (Delete and others) are stopped while Play is open; the pill is centred and the top bar has its own dark background; dead code removed (an unused mode list, an unused icon, an unused export, a dead class, and an unreachable condition).

Not verified in the browser: Delete with Play open (the shortcut block), a height-only resize, mouse-leave on a button, and the centred pill. Tests cover the player and the layout; the browser check is still open.

Known and left as is: the Hide UI item and the section headings are in the request, so they stay. The Play button has its own one-off style, because it has to match Export's shape. Hotspot hints stay on if the Shift key is released while the window is not focused (no blur handler yet). Round 2 changed the responsive branch of `viewportLayout`: it now drives the stage size, so the review note above no longer applies.

## Play viewer: round 2 (disabled layers, scaling, chrome, scroll behaviour)

Fixture: `scripts/fixtures/prototype-fixture.midas` (document name "Prototype fixture"), imported from the home page, then its Flow page. Pane emulated at 375 x 812 for the responsive and scroll checks, reset to desktop after. Clicks by element reference, not by coordinate, because the pane's pointer mapping is not reliable.

Disabled root cause (measured in the pane with real clicks on the disabled Unavailable button and its label):

- Chromium still dispatches `pointerdown`, `mouseenter` and `mouseleave` to a disabled button and to its label. It does not dispatch `mousedown`, `mouseup` or `click` to them.
- Play listened to `mouseenter` and `mouseleave` on every layer, and never checked whether the layer was disabled. So a disabled Button still ran mouse-enter and while-hovering interactions. The native suppression only covered click, mouse down and mouse up.
- Fix: every layer's listener checks `isDisabledTarget` (the layer or any layer it sits in is a disabled Button) and returns before the player is called. A disabled layer also shows `aria-disabled="true"` and the `not-allowed` cursor.

| Check | Result |
| --- | --- |
| Click on the label of the disabled Unavailable button: frame unchanged (still Home), chrome hides (a click that triggers nothing) | Pass |
| Disabled button cursor is `not-allowed` | Pass |
| Top edge zone (pointer at y 10) shows the chrome | Pass |
| Click on an empty part of the frame hides the chrome | Pass |
| Ctrl+\ pins the chrome hidden; the top edge does not show it while pinned; the one-time toast "Press Ctrl+\ to show the toolbar" appears | Pass |
| Ctrl+\ again shows the chrome | Pass |
| A Button click navigates (Home to Details, Details Back to Home) and the chrome stays shown | Pass |
| Z cycles Fit width and height, Actual size, Responsive, Fit width, Fit width and height; the label names the mode; the checkmark follows with the menu open | Pass |
| Responsive at 375 px: the frame is 375 x 812 (the window), the 600 px fixed bar is clipped by the frame | Pass |
| Overflow Horizontal on Details: the frame scrolls on x (scroll width 648, client width 375); the bar moves with the scroll; the chrome stays shown | Pass |
| Overflow Vertical on Home with no content taller than the frame: the warning icon shows, with the tooltip "For scrolling to work on this frame, the content needs to be bigger than the frame." | Pass (title attribute read in the DOM; the native tooltip is not in the screenshot) |
| Overflow Horizontal on Details (content 600 wider than 375): no warning | Pass |
| Toolbar Play: 32 x 32, no border, transparent, same height as Export (32 px); the triangle is 20 px; the avatar is 28 px and centred on the same line | Pass |
| Preferences: a stored `fill-screen` maps to Fit width and height, unknown values map to Actual size | Pure test only (`prototype-viewport.test.js`); the load path in `loadPlayPrefs` is not run in the browser |
| Delete with Play open does not edit the document | Not run in round 2 (the shortcut block is `stopPropagation` in `onKey`) |
| Shift hints, viewport background, Reset on restart | Not run in round 2 |
| Nested after-delay and an on-click on a parent with a child interaction | Not run in round 2 |

Other defects found and fixed in round 2:

- Rectangles were never drawn in Play: `toDomTree` listed `rectangle`, but the document's layer type is `rect`. The fixture now has a fixed-size rect inside Details, and tests use `rect`.
- A frame's `overflow` would have been removed by the first interaction edit (the planner rebuilt the prototype with only interactions). The planner keeps it now, and a test covers each edit.
- The flex sizing of a child set `flex` on the width regardless of the parent's direction. Sizing is per axis now (`flowSizing`), with the table test in `prototype-layout.test.js`.
- The Scroll behaviour warning compared a node's `w`/`h` to `width`/`height`. The panel passes the frame's size with the right names.

Not verified or open:

- A click on a child layer does not reach its parent's on-click: the innermost layer answers, and a layer with no interaction does not pass the click up, so clicking a text layer inside a frame with an on-click does not run the frame's interaction. Found by reading the code, not run in the browser. Separate defect, left as it is.
- Every frame clips by default now; the existing `clip` flag no longer decides clipping. Confirm this is the intent.
- Button instances are frames, so they also show the Scroll behaviour section.
- Files this pass created in the workspace: several "Untitled" files from deep-link redirects and test imports, plus "Behavior fixture" and "Behavior fixture (copy)". Delete them from All files when done.
