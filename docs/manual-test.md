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
