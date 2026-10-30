# Behavior Engine Spec

Source of truth for the Behavior engine. Read this before each task. Update the Status section when a stage finishes.

## Goal

Behavior tab binds a canvas component to a built-in template (Ant Design-structured React component contract). Props come from the template schema, so preview and code generation are deterministic.

## Decisions

- Templates are pure data schemas (anatomy, props, tokens, states, events). Engine logic never lives inside a template. Values are not tied to Ant Design; structure is.
- Binding: component -> templateId. Each variable-prop (variant, size) -> one variable collection. Auto-match by name (case-insensitive). No match = empty, user picks from a dropdown manually. Modes of the bound collection are the prop's values as-is. Custom modes are allowed.
- Dimensions (props) are locked by the schema. Users cannot add props (e.g. no `shape`). Only values/modes of schema-defined variable dimensions are open.
- Diagnostics cover only the collections the template needs: whether each dimension is bound to the master, and whether the required variables exist in the bound collection. A collection no template needs is never scanned or reported.
- Size mode resolves to tokens: fontSize, lineHeight, paddingX, paddingY, gap, radius, iconSize. Variant mode resolves to bg, fg, border (plus per-state).
- Per-state tokens: the variant collection holds `bg`, `bg-hover`, `bg-active`, `bg-disabled`. `disabled` is an instance prop; `hover` and `active` are runtime states used only by the preview renderer and the code generator. The template schema declares which tokens each state overrides (`stateTokens`). A missing state token is a diagnostics error (stage 9), never a silent fallback to `bg`.
- Master vs instance: master holds only binding (template + collections). Instances hold prop values (hasIcon, iconPlacement, icon, loading, disabled, variant mode, size mode). Master never holds icon choice or placement.
- Managed slots: anatomy slots marked `managed` (iconStart, iconEnd) are inserted/removed by Behavior per instance based on hasIcon/iconPlacement. Icon spacing uses the size `gap` token. Managed layers are marked "managed by Behavior".
- Icon source: Midas built-in library, or SVG components in the current file (raw SVG is not selectable). Single-color icons normalize to `currentColor`; multi-color icons are flagged "not themeable"; user can toggle themeable manually.
- Preview renders the real React template component with props and CSS variable tokens from binding. Generated code uses the same components.
- Behavior defaults live in the template (e.g. Input `validateOn` default `blur`). Loading/disabled block onClick.
- Prototype (frame-to-frame interactions, overlays, scroll/sticky) is a separate tab, out of scope for now. Behavior events with `exposeAsTrigger: true` become Prototype triggers later.
- Auto-match: a variable slot is bound to the one collection whose name matches it (case-insensitive, surrounding spaces ignored). Two collections with the same name bind nothing: the choice would be a guess. No fuzzy match. Matching runs on template bind, and again whenever the collections change (created, renamed or removed) while a slot is unbound. A slot that has a binding, manual or automatic, is never changed. Rationale: the Variables window creates a collection as "Collection 1" and it is renamed afterwards, so matching only at bind time left slots empty.
- Lazy open (more than three pages), decision: strict. Every page is checked when it loads (phase 1 and phase 2), before it becomes editable. A cross-page rule runs when either of its pages arrives: an instance whose master is not loaded yet waits for that master. A page that fails is not made editable, stays empty, is never written back, and its error is shown with the page and node. Save waits until every page has loaded or failed, so no page is written unchecked. Rationale: the file on the server is never overwritten with a partial document, and nothing is shown as valid before it has been checked.
- Pasting a managed layer without its instance is refused, naming the layer (pasteSelection). A whole instance, with its managed layers, pastes and syncs in the Paste layers transaction.
- Template rollout: Button only until the full pipeline works end to end. Next: Input, Checkbox, Select, Form, Modal, Tabs.
- Focus outline: `outline` is a preview colour (like bg and border). The root is drawn with `outline: 2px solid <outline-color>` and `outline-offset: 1px` (static schema values, `outline` on the template). outline-color is transparent by default and the focus preview sets it to the Color's outline (controlOutline, or colorErrorOutline for danger). A disabled Button never shows it, because the focus block is guarded by `:not(:disabled)`. The canvas draws bg and border only, so focus has no canvas preview.
- Variant styles: a variable prop may name a border style per mode (`styles` on the prop; Button's Variant has dashed). The rule is schema data, not a token. Codegen writes `border-style` for that mode; Play uses the same stylesheet; the canvas sets the root stroke to a dash (4 px dash, 4 px gap, the canvas's own values, since there is no token for them). The root has a 1 px border in every mode (antd's line width), so the dash shows.
- Known limit: the template resolves Semantic (the Light and Dark modes of the library) in Light only. A Button bound to the library shows its Dark values on the canvas, not in the generated code or Play. Not fixed yet.
- Intentional deviation from antd v5: Button has `hasIcon` and `iconPlacement` props instead of antd's `icon` placement by children order. The canvas needs a boolean and a slot to create and place the managed icon layer, so the icon slot is driven by these props (`icon.show`, `icon.placement`, `icon.component` in the schema).
- Template data declares what the engine needs: `element`, `icon`, `tokenKinds`, `statePseudo`, and a prop's `node` (the node field a literal prop writes). The engine holds no component names.

## Button schema

- anatomy: iconStart (optional, managed), label (text, required), iconEnd (optional, managed)
- props:
  - variant (variable, collection "Variant": outlined, dashed, solid, filled, text, link)
  - color (variable, collection "Color": default, primary, danger)
  - size (variable, collection "Size": small, middle, large)
  - label (string, "Button")
  - hasIcon (boolean, false), iconPlacement (start | end | both, "start", visibleIf hasIcon), icon (iconComponent, visibleIf hasIcon). `both` shows the same icon before and after the label (iconStart and iconEnd). Icon-only is its own template (IconButton), out of scope here: Button always draws its label.
  - loading (boolean, false), disabled (boolean, false)
- structure: antd v5 (components/button/style). Names are ours. Variant values alias into Color, Color into Semantic (antd's global tokens).
- tokens:
  - fromSize: height, fontSize, lineHeight (unitless ratio), paddingX, paddingY, gap, radius, iconSize
  - fromVariant: bg, fg, border, bg-hover, fg-hover, border-hover, bg-active, fg-active, border-active, bg-disabled, fg-disabled, outline-color (transparent in every variant)
  - fromColor: color, color-hover, color-active, color-border(-hover, -active), color-bg(-hover, -active), color-text(-hover, -active), color-text-bg(-hover, -active), color-solid(-hover, -active, -text), color-outline
- states: default, hover, active, focus, disabled, loading
- persistentStates: disabled { prop disabled, replaces bg with bg-disabled, fg with fg-disabled }
- previewStates: hover { bg, fg, border with their -hover tokens }, active { the -active tokens }, focus { outline-color with color-outline }
- events:
  - onClick (exposeAsTrigger true)
  - onHover (exposeAsTrigger true)
  - onFocus (exposeAsTrigger false)
  - onBlur (exposeAsTrigger false)

## Stages

Execute in the order listed. The numbers are stage IDs, not the execution order.

1. Schema + registry
2. Binding model
3. Instance props store
5. Panel renderer
4. Variable -> token resolver
6. Anatomy sync
7. Preview renderer
8. Code generator
9. Diagnostics

## Status

Behavior rework pass (latest): layout ownership (`isLayoutOwnedField`: x/y for flow children of auto-layout parents, hug and fill axes), canvas preview for bg and border (`canvasColorsOf`), shared label rule (`labelLayerOf`, `masterLayersOf`), edit helpers (`edits.js`). Open: Kopi Kita master resize, bind-tokens browser check, Focus preview on a fixture with a stroke width, Canvas 2D fallback preview.

Load rules (AGENTS.md), implemented:

- Phase 1, per node: version and shape of `behavior` data (`behavior-engine/data.js`).
- Phase 2, whole document: each instance's props checked against its master's template and binding (`behavior-engine/document-check.js`). Prop names, value types, hidden props holding a value, and modes against the bound collection.
- Instancing: a copy gets the master's props store, not the binding (`instanceBehaviorOf`); instance sync omits `behavior`.
- Phase 2 runs on import or parse (`DocumentModel.parse`) and on a full project open (`loadProject` with no lazy queue).
- Lazy open: phase 2 runs per page as each page arrives (assertPagesBehavior), so a cross-page instance is checked when either page arrives. Closed. The root cause was that a lazy page was parsed as a one-page document, so an instance whose master was on another page failed, and the failure was only logged. A failing page now shows its error.

- [x] Stage 1: Schema + registry
- [x] Stage 2: Binding model
- [x] Stage 3: Instance props store
- [x] Stage 5: Panel renderer. Master: template picker, collection per variable prop (auto-match prefill), read-only contract. Instance: variable props with bound modes, literal props by type, visibleIf, writes through the instance store. Icon control (iconComponent) deferred to the icon picker stage: not rendered, listed as `deferred` by the model. Old Behavior code removed. Deleting a collection or a mode forgets it in the behavior data (`forgetCollection`). Behavior changes wait until every page of the file is loaded, and clear instance values through the instance store (one write path).
- [x] Stage 4: Variable -> token resolver (`behavior-engine/tokens.js`, `resolveTokens`). Base tokens. Per-state tokens are resolved by the same path (see Per-state tokens in Decisions) and applied by stage 7.
  - Token naming: `--<templateId>-<token in kebab-case>`, e.g. `--button-font-size`, `--button-padding-x`.
  - A `fromX` token group draws from the variable prop named `x` (case-insensitive). A variable matches a token by the last segment of its name (`Button/fontSize` -> `fontSize`), case-insensitive.
  - Stored forms: lengths are numbers in px (`fontSize` 14 -> `14px`); `lineHeight` is stored as a unitless ratio of the font size (the editor writes `lineHeight = px / fontSize`), so it resolves to `1.4`, not px; colours are CSS colour strings (`#rrggbb` or `#rrggbbaa`), passed through.
  - Aliases resolve inside the selected mode, with a cycle check. An alias is `{ alias: itemId }`, and a colour alias may add `opacity` (0-100): it multiplies the alpha of the colour it reaches, with the editor's rounding, so both draw the same colour (`#4338ca` with opacity 50 -> `#4338ca80`). Library changes that remove a collection or a mode are pruned from the behavior data (`pruneBehaviorData`).
  - Unresolved tokens are reported with a reason and never guessed: `dimension-unbound`, `collection-missing`, `no-mode-selected`, `mode-missing`, `no-variable`, `ambiguous`, `no-value-in-mode`, `alias-missing`, `alias-cycle`, `type-mismatch`, `invalid-value`, `no-kind` (token name not in `TOKEN_KIND`), `no-dimension`.
- [x] Stage 6: Anatomy sync (`behavior-engine/anatomy.js`, `planInstanceAnatomy`). Managed icon layers exist only on instances, as many as the values ask: hasIcon false -> none; hasIcon true -> one layer for `start` (`iconStart`, first child) or `end` (`iconEnd`, last child), or both layers for `both`. First and last mean the visual start and end after a flip: a flipped instance root stores its children back to front (`layoutFlip`), and the planner maps its visual positions to stored indexes. A placement change removes the layers it no longer asks for; a layer never changes slot. The planner is pure and returns removes, moves and inserts (removes first, moves and inserts with their final index); the editor applies them in one transaction. Running it again gives no operations.
  - Label rule: the label slot is the master's first text layer inside its root auto layout (depth first). If the master is not an auto layout frame or has no text layer, sync does nothing and reports the reason. Nothing is guessed or created. An unbound master has no managed layers, so its instances lose them without needing a label.
  - Marker: a managed layer carries `behavior: { version, slot }`. It is valid only as a child of an instance; phase 2 fails a file where it sits elsewhere, or where its instance's managed layers do not match the values (missing, unexpected, or at the wrong position). Nothing is repaired.
  - Triggers: an instance's hasIcon or iconPlacement edit, a template bind or unbind (all instances, after all pages load), instantiate, and paste (instances the pasted layers land in or are). Detach strips all behavior data, slot markers included.
  - Placeholder: a 16x16 frame named after the slot, the square an instance shows until it chooses an icon. The icon picker is the Icon row (see Icon slot below). Themeable and currentColor handling is not done.
  - Guards: the editor refuses delete, duplicate, copy, replace-paste, group, align, reorder, move (drag and arrow keys), boolean and flatten on a managed layer, with the reason. Open risk: paste of a managed layer alone is not guarded (manual checklist item 1).
- [x] Stage 7: Preview renderer (`behavior-engine/preview.js`, `previewOf`). Engine only: props and CSS variables for one state. A disabled instance is in the disabled state. A state token that does not resolve is left out and reported, never replaced by `bg`. Schema gains `stateTokens`. Studio: the Behavior panel shows the previewed state (Preview section, studio-side view only). The canvas does not draw the preview.
- [x] Stage 8: Code generator (`behavior-engine/codegen.js`, `generateComponent`). Engine only: `<Name>.jsx` from the schema (anatomy order, managed icons on `hasIcon` and `iconPlacement`, click blocked when disabled or loading) and `<Name>.css` (one block per variant and size mode, state blocks hold only the tokens they change). Refused with the reasons when anything is unresolved. Studio: a Generate code button on a bound master downloads `Button.jsx` and `Button.css` (two downloads); a refusal downloads nothing and its reasons show under Diagnostics.
- [x] Icon slot (swap, colour, size). The Icon row (`icon` prop, kind `icon`) lists the Icon/ components in the file. A slot with a chosen icon holds that icon as a nested instance, sized to fill the slot. Swap changes the `icon` prop, so the slot follows through sync (`planAnatomy` emits `swap`; the slot keeps its place and its layer). The icon's fills bind by index to `button/fg`, its strokes (for a stroke-only icon) to `button/fg`, and the slot's width and height to `button/icon-size`; while disabled, the colour is `button/fg-disabled`. These bindings are owned by the engine (`icon-slot.js`, `iconSlotBindings`) and rewritten on every sync; the copy from the icon component never overwrites them. The variable names match a token with dashes ignored (`button/icon-size` is `iconSize`). A missing variable is named in a toast and nothing is guessed in its place. A layer inside a managed slot is managed through the slot (the guard names the slot).
- [x] Stage 9: Diagnostics (`behavior-engine/diagnostics.js`, `diagnoseDocument`). Errors: `dimension-unbound` and `collection-missing` per master (naming the collection), `variable-missing` and `variable-missing-in-mode` per master and mode, `token-unresolved` per instance for the rest. A binding problem is reported once, on the master. Studio: the Behavior panel lists them in a Diagnostics section (master: its own and document-wide; instance: its own). Hidden while pages are still loading.

## Behavior rework (superseding decisions, not yet implemented)

Status: decisions 1-4 below are answered and being implemented. Where this section and the earlier Decisions or Stages disagree, this section wins.

1. Variant, Size and persistent states are document data. The projection/clone renderer plan (`behavior-engine/projection.js`) is dropped. The "State as a collection" idea is dropped.
2. Variables: one collection per dimension (`Variant`, `Size`). Variables are grouped per component with a `<component>/` prefix: `button/bg`, `button/fg`, `button/bg-hover`, `button/bg-active`, `button/bg-disabled`. Every component group has the same modes inside a collection. Schemas reference the group prefix (`button/`), never global names.
3. Two kinds of state, declared in each template schema:
   - Persistent (stored in the document, visible on the canvas): `disabled`, `current`, `selected`, `checked`.
   - Preview-only (studio-side, colour only): `hover`, `active`, `focus`.
4. Hover, active and focus change colours only (bg, fg, border). A preview-only state that declares a size, padding or radius change is a validator error.
5. Variant and Size controls write the instance's mode for the bound collection through the same path the Appearance section uses (`varModes`, one history step). No `variant` or `size` prop is stored in behavior data. Default is the first mode.
6. Persistent `disabled` writes real document state and selects the `<group>/bg-disabled` and `<group>/fg-disabled` variables. Persistent states are generic in the schema, so a future Breadcrumb Item `current` (tokens `breadcrumb/fg`, `breadcrumb/fg-current`) needs no engine change.
7. Preview-only state is a studio-side view only: never written to the document or to history, reset on selection change or file close, and shown as a "Previewing: Hover" badge. A real `disabled` wins over any preview state. A disabled Button shows only its disabled style: the generated CSS guards hover, active and focus with `:not(:disabled)`, so no interaction colour applies to it. The disabled state overrides `bg` and `fg` only; there is no `border-disabled` token, so the border stays the variant's. Turning Disabled on clears a preview state.
8. `label` writes the label layer's text. `loading` has no node representation yet: it gets a diagnostics note, not a visual.

### Audit (code as it is now)

Appearance section:
- A node stores an explicit mode per collection in `varModes` (`{ [collectionId]: modeId }`). `nodeMode` walks up parents, then the page, then the first mode (`apps/studio/src/engine/midas.js` ~783). Writes happen in three places: the `[data-var-mode]` change handler, the collection menu `pick`, and the `Connect variable collection` handler. Each is its own transaction.
- A bound property stores `n.vars[prop] = variableId`. `applyVariables` (~930) writes the resolved value into the node field (`writeBound`) on each invalidate. So Appearance already materializes bound values into node data. Changing a mode re-resolves the canvas through this path.
- Canvas draws with GPU shaders for simple fills (`midas.js` ~3013 onwards, 2D canvas path at ~3091–3139). A colour override at draw time would touch the draw path, not layout or hit testing.
- Sync (`syncComponents`) copies master keys onto instances unless the instance has an override for that key. `varModes` is not in the omit list, so a master that has `varModes` overwrites its instance's `varModes`. The Behavior mode write on an instance is therefore unsafe until this is decided.

Button schema and engine:
- Schema fields: `stateTokens` (used by `preview.js` and codegen's `PSEUDO`), `display` (used by `display.js`, codegen `displayRules`, and `projection.js`), `props.variant` and `props.size` (variable props, stored in behavior data).
- `previewOf` (`preview.js`): used by the Behavior panel preview and by codegen's stylesheet.
- `projection.js` (`projectInstance`): tested, not wired into the studio. Superseded by decision 1.
- `display.js` `displayProblems`: used by the validator. `codegen.js` `displayRules`: used by codegen. Both survive the rework only if the mapping stays.
- Dead after the rework: `projection.js`; `stateTokens` once preview-only states move to the schema's `previewStates` list; `variant`/`size` props in behavior data.

### Answers (decided)

1. Instance modes vs sync: `varModes` joins the master-to-instance omit list, the same as `behavior`. An instance's own modes are never overwritten by sync.
2. Persistent `disabled`: the instance stores the `disabled` prop. The engine derives the root fill (and fg, border where the schema says so) binding from the props, in the same instance sync and transaction: disabled on -> `<group>/bg-disabled`; off -> back to the master binding (`<group>/bg`). Derivation is idempotent, one history step. A binding the user set by hand on the instance is never overwritten; it is reported as a diagnostics warning. Appearance shows the same binding because it is the same `vars` binding.
3. Preview colours: a draw-time colour lookup is allowed only as a narrow optional lookup (instance layer id -> substitute colours for bg, fg, border). It lives in studio state, never in the document or history, and is cleared before save, on selection change and on file close. `applyVariables` never writes preview values into node fields.
4. Migration: behavior data is version 2. No migration. Version 1 data fails to open with the explicit error.

## Manual test checklist

Everything the automated tests do not cover. Run once after stage 9, highest risk first.

1. Keyboard reorder and arrow-key move of a managed layer: refused with the reason, and the layer stays in its slot.
2. Whole-instance copy and paste via the clipboard: the instance keeps its props, and its managed layers come back with markers, in order.
3. Editor-path coverage that Node tests cannot import: paste, cross-page paste, detach, sync triggers (hasIcon and iconPlacement edits, bind and unbind, instantiate), and a save and reopen round trip.
4. Stage 7 (canvas not wired): the Preview section shows the resolved tokens of the chosen state. Check against a file that has Variant and Size collections: hover, active and disabled rows change the bg value; no document change or undo entry is made.
5. Stage 8: the two downloaded files render in a plain React project, and the `data-variant` and `data-size` selectors match the mode ids. Check that the browser accepts both downloads (it may ask once to allow multiple downloads).
6. Stage 9: each error shows in the Diagnostics section, and an unbound dimension names its collection on the master. Check a large file (the 6.7 MB Ant Design sample): the Behavior tab recomputes diagnostics on every change, so check it stays responsive.
7. Rollback message: a change that would make the file fail to open is undone, with "Not applied" and the reason.
8. Behavior panel UI cleanup (stage 5 leftovers).
9. Canvas selection fix confirmation (commit f1fd440).
10. Populated Preview: token rows were not visually checked (the test file has no Variant or Size collections). Check the rows and their values with collections bound.
11. Lazy open: Diagnostics show the "appear when all pages are loaded" note until the queue drains, then the findings.
12. Editor wiring of the auto-match triggers, the lazy page error toast and the paste refusal toast is not browser-checked. The rules themselves are covered by unit tests.

## Decisions recorded later (supersede the rework section where they differ)

1. lineHeight is a unitless ratio. A variable named Button/lineHeight holds the ratio per Size mode, (fontSize + 8) / fontSize (1.5714 at 14 px, 1.5 at 16 px), and resolves unchanged; codegen writes it as line-height without a unit. The node field lineHeight is the same ratio, so a bound label takes the variable directly.
2. Override detection compares bindings, not materialized values. A field bound through vars is never an override (fieldsBoundBy). The master copy does not overwrite a bound field either (isCopiedField): its variable decides its value.
3. Canvas preview is scoped to the instance root background and border (bg and border). The preview is a per-instance colour lookup read in the GPU quad path, not stored in the document or history. Persistent disabled wins over any preview state. Text colour (fg) stays in the Preview section as read-only rows; the glyph atlas is not changed.

Churn finding (write counts for one Disabled toggle on Save, measured with a temporary trace):
- Before the copy fix, the copy loop in syncComponents rewrote Cancel's bound fields on every sync (10 writes on Cancel, 5 on its label). These were the master's values being copied onto bound fields and then re-applied by applyVariables.
- After the copy fix: 2 writes on Cancel and 3 on its label, from unbound geometry fields copied from the master (x, y, w, h). The layout engine measures and rewrites these, so they still churn. Open: layout ownership of x, y, w and h on instance children.
4. Layout ownership (implemented): the copy from master to instance, and the override check, skip the fields the layout engine writes: x and y of a flow child of an auto-layout parent, and the axis a hug or fill child takes from layout (`isLayoutOwnedField`, `instance-vars.js`). Absolutely positioned children and fixed sizes are still copied.
5. Canvas preview (implemented, scoped): the studio's canvas draws the selected instance's root background and border in the Hover, Active and Focus preview (`canvasColorsOf`, read per draw in the GPU quad path). Text colour stays in the Preview section, with the note "Text color preview not on canvas". The Canvas 2D fallback does not draw it.
6. The label is the first text layer, depth first (`labelLayerOf`, `layers.js`). Diagnostics and the studio's owned-field check share it.

Known debt (left as is after the review, see the review findings in this session's report):
- The layout rule in `isLayoutOwnedField` mirrors `runLayout` in midas.js; it is not shared with it.
- `applyStateBindings`, `applyLiteralFields` and `writeVarMode` still mutate nodes in place. Their decisions are in `edits.js` and `layers.js`, but the writes are not.
- `constrainInstanceLayers` decides x/y for flow children inline instead of through `isLayoutOwnedField`.
- The copy loop in `syncComponents` repeats a small `vars && owned.length` branch three times.
- Cache of the preview lookup is keyed on `doc.revision`; a write that does not touch the document would leave it stale.
- Icon colour and hover/active previews: the icon takes its colour from `button/fg` (and `button/fg-disabled` while disabled), but the hover and active previews change only the root background and border on the canvas. So the icon colour does not change in those previews. This ships with the canvas foreground preview, later.
