# Input: managed text layers (built)

Status: built (steps 1 to 6 of the plan, committed on `feat/fahmi`). A freshly created Input shows **one** text node in the layer panel, the placeholder. The value, the prefix text, the suffix text and the counter exist only while the props ask for them. This follows the managed icon slots (layers of an instance that the engine creates and removes from the props), which already worked this way for the Input's icons.

Unit tests cover the schema, the planner, the generator, the binder, Play and the export. The studio wiring (`apps/studio/src/engine/midas.js`) and the browser parity suites have not been run against this model: see section 6.

## 1. The model

**A managed text layer.** An anatomy slot of `kind: 'text'` or `'control'` with `managed: true` is a layer of an **instance only**. The schema must also give it `optional: true` and a `shownWhen` (the condition under which the instance has the layer); the validator refuses a managed text or control slot without them, and an icon def cannot name one. The master has none: `layerSpecsOf` lists it with role `slot` and type `text`, and the generator skips every `slot` role. `planAnatomy` makes the layer when `shownWhen` holds and removes it when it stops holding; `instanceOf` makes it on a new instance (`managedTextLayer`, in anatomy order, `indexAmongLaterSlots`). The layer carries the marker `behavior.slot` and is not a copy of a master layer (no `sourceId`).

**The text stays in the prop.** The layer's text is written from its prop (`literalFields`, plus `partWrites` for a counter), so a layer removed when a switch goes off and made again when it comes back shows what the designer typed: `prefixText`, `suffixText` and `value` are kept in the instance's props whether or not the layer exists. Content typed into the layer itself is the prop's: a layer is a drawing of its prop, not a second store.

**A primary slot.** The schema names its primary text part: `primarySlot: 'label'` (Button, FormItem) or `'value'` (Input). The engine reads that key instead of a literal `label`. A template with a required text or control slot declares it; a template with none declares none. The primary slot may itself be managed (the Input's `value`), and then it satisfies the rule "anatomy needs a required text or control slot".

**The counter is a managed text slot.** `count` is an anatomy slot (`kind: 'text'`, managed, `shownWhen: { prop: 'showCount', is: true }`) with `text: { counter: { value, max } }`, no longer a canvas part. `partWrites` writes its text (the value's length, and ` / max` when there is a maximum) as it does for a counter part.

**The master holds the placeholder only.** The placeholder is a canvas part, the one text layer of an Input master and the layer a designer styles. A master's layer panel: `Input` root, `placeholder`.

### What exists, per case (instance; the master is always root + placeholder)

| Props | Instance layers (the layer panel) |
|---|---|
| fresh Input | `placeholder` (visible only if it has text) |
| placeholder typed | `placeholder` |
| value typed | `placeholder` (hidden: a value beats it), `value` |
| value cleared | `placeholder` (the `value` layer is removed) |
| Disabled, no value | `placeholder` |
| Disabled or Read only, value set | `placeholder` (hidden), `value` |
| prefix on, Text, with text | `prefixText` + the rest |
| prefix on, Icon | `prefixIcon` (the managed icon slot) + the rest |
| Show count on | `count` + the rest |

The order is the anatomy's: `prefixIcon`, `prefixText`, then the master's `placeholder`, `value`, `count`, `clear`, `suffixText`, `suffixIcon`. The placeholder is a master part, so it comes first among the layers the anatomy does not rank, and the `value` layer after it. Only one of the two shows at a time. A layer the props stop asking for is **removed**, not hidden; a style a designer gave the layer itself (a colour override on `value`) is lost with it, as for an icon slot.

## 2. Binding: the instance's own layer

A managed text layer has no master layer to carry bindings, so the engine binds the instance's layer to the template's token variables itself. `planManagedTextBindings` (bind-tokens.js) maps each display property of the slot (fill, typography) to the variable of its token in the master's bound collections, and to the state's variable while a persistent state is on (disabled: `fg-disabled`). It uses the same ops as `planBindTokens`, so `applyBindTokens` writes them. A binding that is neither the base nor the state's variable (a designer's) is kept; one pointing at a variable that no longer exists is rebound; an unbound dimension is a problem, not a guess; a second run changes nothing.

## 3. Where the engine reads it

- **`labelEntryOf(id, childrenOf, parent, primary)`** (layers.js): a managed text layer (`behavior.slot`) is the label only when its slot is the primary one; every other managed layer is skipped, as a canvas part and an affix text are. A master holds no managed layer, so a master needs no `primary`. Play passes `primarySlotOf(template)`.
- **`slotWanted` / `slotShown`** (template-master.js): a managed text or control slot is wanted and shown while its own `shownWhen` holds; icon defs decide only icon slots.
- **Diagnostics `part-missing`** and **Auto Fix**: a managed slot is an instance layer and is never required of a master (the rule skips role `slot`, icon or text). A deleted placeholder is still reported and Auto Fix restores it. Auto Fix and the generator never recreate what is intentionally absent, and a text layer a master holds under a managed name is kept as an unknown layer, not claimed. The `icon-slot-empty` warning looks at managed frames only, not text layers.
- **Export (codegen)**: the control's `<input>` is always written, from props (`value`, `placeholder`, `readOnly`, limits), whether or not a value layer exists. The counter is written after the control, where the anatomy ranks it. For a generated master the exported `Input.jsx` and `Input.css` are byte-identical to the ones from before this change. A managed text slot with no master layer lays out as the layer an instance gets (the value fills, the rest hug).
- **Play (`dom-tree.js`)**: the input is drawn from props, over the value layer if there is one and the placeholder's box while the value is empty; the counter and the affix text are drawn from their own layers, the counter marked `data-role="count"`.
- **Studio** (`midas.js`): `syncInstance` makes and removes the layers from the plan (`managedTextLayer`) and binds them (`applyManagedTextBindings`); `applyLiteralFields` writes a managed text layer's text from its prop, finding it by slot id, and writes the primary layer under `template.primarySlot` (the target key), not a fixed `label`.

## 4. The state model

- Disabled and Read only: both non-interactive, both the disabled look (`stateOn`). Neither is focusable on any surface.
- Disabled with no value shows the placeholder; Read only shows the value, and an empty Read only shows the placeholder. A value beats the placeholder in both: the `value` layer exists and the placeholder layer is hidden.
- The control in Play and the export reads **props**, not nodes: the `<input>` holds `value` and `placeholder` whether or not a `value` layer exists. The `value` layer is the canvas's drawing of it.

## 5. The rename, existing files

Button and FormItem keep `label`; the Input's text part is `value` (anatomy id, display key, `control.slot`, the prop's node key, the class `.input-value`). **No shim:** a file made before has an Input master with `label` or `value` and the four other layers, and instances without managed layers; the new template treats those layers as unknown (kept, not recognised). Existing Inputs are regenerated (Create Input again; the fixtures and `testing.midas` regenerate with the make scripts, and were). Files with no Input are not affected. Binding a frame that already holds a text layer to Input no longer turns that layer into the value: it is kept as it is.

## 6. What is and is not verified

Verified by unit tests (builder-core): the validator (`managed-text-schema`), the planner (`managed-text-plan`), `instanceOf` (`managed-text-instance`), the binder (`managed-text-bindings`), and the Input end to end (`input-managed-text`: one text node on a fresh Input, layers on demand, text kept across a toggle, a complete master, Play and the export).

The studio wiring is covered indirectly (`apps/studio/test/managedTextWiring.test.js`): `midas.js` needs a browser to load, so the test reads its source (what `syncInstance` calls, in which order; the literal-field target key) and replays the same builder-core sequence over a plain node list (a layer made on a toggle, bound, written from its prop, removed and made again).

**Not verified without a browser:** `midas.js` itself running (the `doc` calls, `remeasureText`, the undo step, the toast on a missing icon variable); the canvas drawing of a freshly made text layer (typography, measuring); canvas = Play = export parity; and the browser suites (strict parity, export parity, affix, input-live, parts), which assert the old node structure in places and need editing before they can pass.

## 7. History

The model was designed first and landed in this order: (1) `primarySlot`, (2) the rename `label` to `value`, (3) managed text in the schema and validator, (4) instance creation and removal, (5) instance-level bindings, (6) the Input switched, fixtures regenerated, (7) these docs. The cheaper option (not listing hidden layers in the panel) was not taken.
