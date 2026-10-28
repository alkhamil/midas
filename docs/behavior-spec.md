# Behavior Engine Spec

Source of truth for the Behavior engine. Read this before each task. Update the Status section when a stage finishes.

## Goal

Behavior tab binds a canvas component to a built-in template (Ant Design-structured React component contract). Props come from the template schema, so preview and code generation are deterministic.

## Decisions

- Templates are pure data schemas (anatomy, props, tokens, states, events). Engine logic never lives inside a template. Values are not tied to Ant Design; structure is.
- Binding: component -> templateId. Each variable-prop (variant, size) -> one variable collection. Auto-match by name (case-insensitive). No match = empty, user picks from a dropdown manually. Modes of the bound collection are the prop's values as-is. Custom modes are allowed.
- Dimensions (props) are locked by the schema. Users cannot add props (e.g. no `shape`). Only values/modes of schema-defined variable dimensions are open.
- A collection on the canvas not bound to any dimension of the component: warn "unused collection"; excluded from preview and code generation.
- Size mode resolves to tokens: fontSize, lineHeight, paddingX, paddingY, gap, radius, iconSize. Variant mode resolves to bg, fg, border (plus per-state).
- Per-state tokens: the variant collection holds `bg`, `bg-hover`, `bg-active`, `bg-disabled`. `disabled` is an instance prop; `hover` and `active` are runtime states used only by the preview renderer and the code generator. The template schema declares which tokens each state overrides (`stateTokens`). A missing state token is a diagnostics error (stage 9), never a silent fallback to `bg`.
- Master vs instance: master holds only binding (template + collections). Instances hold prop values (hasIcon, iconPlacement, icon, loading, disabled, variant mode, size mode). Master never holds icon choice or placement.
- Managed slots: anatomy slots marked `managed` (iconStart, iconEnd) are inserted/removed by Behavior per instance based on hasIcon/iconPlacement. Icon spacing uses the size `gap` token. Managed layers are marked "managed by Behavior".
- Icon source: Midas built-in library, or SVG components in the current file (raw SVG is not selectable). Single-color icons normalize to `currentColor`; multi-color icons are flagged "not themeable"; user can toggle themeable manually.
- Preview renders the real React template component with props and CSS variable tokens from binding. Generated code uses the same components.
- Behavior defaults live in the template (e.g. Input `validateOn` default `blur`). Loading/disabled block onClick.
- Prototype (frame-to-frame interactions, overlays, scroll/sticky) is a separate tab, out of scope for now. Behavior events with `exposeAsTrigger: true` become Prototype triggers later.
- Template rollout: Button only until the full pipeline works end to end. Next: Input, Checkbox, Select, Form, Modal, Tabs.

## Button schema

- anatomy: iconStart (optional, managed), label (text, required), iconEnd (optional, managed)
- props:
  - variant (variable, collection "Variant")
  - size (variable, collection "Size")
  - label (string, "Button")
  - hasIcon (boolean, false)
  - iconPlacement (start|end, "start", visibleIf hasIcon)
  - icon (iconComponent, visibleIf hasIcon)
  - loading (boolean, false)
  - disabled (boolean, false)
  - fullWidth (boolean, false)
  - No `danger` prop; it is a variant mode.
- tokens:
  - fromSize: fontSize, lineHeight, paddingX, paddingY, gap, radius, iconSize
  - fromVariant: bg, fg, border, bg-hover, bg-active, bg-disabled
- states: default, hover, active, focus, disabled, loading
- stateTokens: hover { bg: bg-hover }, active { bg: bg-active }, disabled { bg: bg-disabled }. Focus and loading override nothing.
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

Load rules (AGENTS.md), implemented:

- Phase 1, per node: version and shape of `behavior` data (`behavior-engine/data.js`).
- Phase 2, whole document: each instance's props checked against its master's template and binding (`behavior-engine/document-check.js`). Prop names, value types, hidden props holding a value, and modes against the bound collection.
- Instancing: a copy gets the master's props store, not the binding (`instanceBehaviorOf`); instance sync omits `behavior`.
- Phase 2 runs on import or parse (`DocumentModel.parse`) and on a full project open (`loadProject` with no lazy queue).
- Open gap: a lazy project open (more than three pages) runs phase 1 only, and this stays true even when its page queue drains later. Partial loads (lazy open, single page) need the instance-to-master check once the document is complete. Not built yet.

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
- [x] Stage 6: Anatomy sync (`behavior-engine/anatomy.js`, `planInstanceAnatomy`). Managed icon layers exist only on instances, as many as the values ask: hasIcon false -> none; hasIcon true -> one layer, first child for `start` (`iconStart`), last child for `end` (`iconEnd`). A placement change removes the old layer and inserts the new one; a layer never changes slot. The planner is pure and returns removes, moves and inserts (removes first, moves and inserts with their final index); the editor applies them in one transaction. Running it again gives no operations.
  - Label rule: the label slot is the master's first text layer inside its root auto layout (depth first). If the master is not an auto layout frame or has no text layer, sync does nothing and reports the reason. Nothing is guessed or created. An unbound master has no managed layers, so its instances lose them without needing a label.
  - Marker: a managed layer carries `behavior: { version, slot }`. It is valid only as a child of an instance; phase 2 fails a file where it sits elsewhere, or where its instance's managed layers do not match the values (missing, unexpected, or at the wrong position). Nothing is repaired.
  - Triggers: an instance's hasIcon or iconPlacement edit, a template bind or unbind (all instances, after all pages load), instantiate, and paste (instances the pasted layers land in or are). Detach strips all behavior data, slot markers included.
  - Placeholder: a 16x16 frame named after the slot. Style, size and content are not managed. The icon picker is deferred: the placeholder is not an icon, and no library, themeable or currentColor handling exists yet.
  - Guards: the editor refuses delete, duplicate, copy, replace-paste, group, align, reorder, move (drag and arrow keys), boolean and flatten on a managed layer, with the reason. Open risk: paste of a managed layer alone is not guarded (manual checklist item 1).
- [x] Stage 7: Preview renderer (`behavior-engine/preview.js`, `previewOf`). Engine only: props and CSS variables for one state. A disabled instance is in the disabled state. A state token that does not resolve is left out and reported, never replaced by `bg`. Schema gains `stateTokens`. Studio: the Behavior panel shows the previewed state (Preview section, studio-side view only). The canvas does not draw the preview.
- [x] Stage 8: Code generator (`behavior-engine/codegen.js`, `generateComponent`). Engine only: `<Name>.jsx` from the schema (anatomy order, managed icons on `hasIcon` and `iconPlacement`, click blocked when disabled or loading) and `<Name>.css` (one block per variant and size mode, state blocks hold only the tokens they change). Refused with the reasons when anything is unresolved. Studio: a Generate code button on a bound master downloads `Button.jsx` and `Button.css` (two downloads); a refusal downloads nothing and its reasons show under Diagnostics.
- [x] Stage 9: Diagnostics (`behavior-engine/diagnostics.js`, `diagnoseDocument`). Errors: `token-unresolved` per instance, `state-token-missing` per master and mode. Warning: `unused-collection`. Studio: the Behavior panel lists them in a Diagnostics section (master: its own and document-wide; instance: its own). Hidden while pages are still loading.

## Manual test checklist

Everything the automated tests do not cover. Run once after stage 9, highest risk first.

1. Paste of a managed layer alone: copy only the icon placeholder and paste it. The result must be refused or leave the file valid.
2. Keyboard reorder and arrow-key move of a managed layer: refused with the reason, and the layer stays in its slot.
3. Whole-instance copy and paste via the clipboard: the instance keeps its props, and its managed layers come back with markers, in order.
4. Editor-path coverage that Node tests cannot import: paste, cross-page paste, detach, sync triggers (hasIcon and iconPlacement edits, bind and unbind, instantiate), and a save and reopen round trip.
5. Lazy open (more than three pages): phase 2 runs on phase 1 only. Confirm an invalid instance is caught once the queue drains. Known gap, not built.
6. Stage 7 (canvas not wired): the Preview section shows the resolved tokens of the chosen state. Check against a file that has Variant and Size collections: hover, active and disabled rows change the bg value; no document change or undo entry is made.
7. Stage 8: the two downloaded files render in a plain React project, and the `data-variant` and `data-size` selectors match the mode ids. Check that the browser accepts both downloads (it may ask once to allow multiple downloads).
8. Stage 9: each error shows in the Diagnostics section, and the unused-collection warning appears for an unbound collection. Check a large file (the 6.7 MB Ant Design sample): the Behavior tab recomputes diagnostics on every change, so check it stays responsive.
9. Rollback message: a change that would make the file fail to open is undone, with "Not applied" and the reason.
10. Behavior panel UI cleanup (stage 5 leftovers).
11. Canvas selection fix confirmation (commit f1fd440).
12. Collection auto-match: confirm it does not run in some path, and check which one.
13. Populated Preview: token rows were not visually checked (the test file has no Variant or Size collections). Check the rows and their values with collections bound.
14. Lazy open: Diagnostics show the "appear when all pages are loaded" note until the queue drains, then the findings.
