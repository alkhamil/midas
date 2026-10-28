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
