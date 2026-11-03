# Input: managed text layers (design only, not built)

Status: design for review. **No code.** Goal: a freshly created Input shows **one** text node in the layer panel, the placeholder, not a set of hidden nodes. The value, the prefix text, the suffix text and the counter exist only while the props need them. It follows the managed icon slots (layers of an instance that the engine creates and removes from the props), which already work this way for the Input's icons.

## 0. What exists now (measured in the studio)

A new Input master and each instance hold five text layers: `prefixText`, `label` (the value), `placeholder`, `count`, `suffixText`, four of them hidden by their conditions (a master part starts hidden since the last fix). The layer panel lists all five. `label` is not only a name: it is the engine's fixed key for the template's primary text layer (`labelEntryOf`, the studio's `'label'` role key, `instanceLabelOf`, the panel's Label row, the display key `label`, the class `input-label`), found as the first text layer that is neither a part nor an affix.

## 1. Proposed model

**(a) A managed text layer.** An anatomy slot (or part) of `kind: 'text'` with `managed: true` is a layer of an **instance only**, like a managed icon slot: the master has none; the instance gets one while its props ask for it (`shownWhen`: the value is not empty; the prefix switch is on with Text and a non-empty text; the same for the suffix; `showCount` is on) and loses it when they stop asking. The generator never builds it on a master; `instanceOf` and `planInstanceAnatomy` create and remove it, in anatomy order (`indexAmongLaterSlots`, as for icons).

**(b) A primary slot.** The schema names its primary text layer: `primarySlot: 'label'` (Button, FormItem) or `primarySlot: 'value'` (Input). The engine reads that key instead of the literal `label`. Then the Input's `label` is renamed `value`.

**(c) The master holds the placeholder only.** The placeholder is the one text layer of an Input master: it is the part that is always there, the layer a designer styles. A master's layer panel: `Input` root, `placeholder`.

### What exists, per case (instance; the master is always root + placeholder)

| Props | Instance layers (the layer panel) |
|---|---|
| fresh Input | `placeholder` (visible only if it has text) |
| placeholder typed | `placeholder` |
| value typed | `value` (new), `placeholder` (hidden: a value beats it) |
| value cleared | `placeholder` (the `value` layer is removed) |
| Disabled, no value | `placeholder` |
| Disabled or Read only, value set | `value`, `placeholder` (hidden) |
| prefix on, Text, with text | `prefixText` + the rest |
| prefix on, Icon | `prefixIcon` (the existing managed icon slot) + the rest |
| Show count on | `count` + the rest |

A layer the props stop asking for is **removed**, not hidden. What a designer typed into it as a style (a colour override on `value`) is lost with it, as for an icon slot; its content is remembered by the prop (`remembered`), as the prefix text and icon are today.

## 2. part-missing and Auto Fix

- A managed text layer is an instance layer, so it is **never required of a master** (the rule already skips managed icon slots; it skips managed text too). A master without `value`, `prefixText`, `suffixText` or `count` is complete.
- A real deleted part is still reported: the placeholder is a required canvas part, so a master without it is `part-missing` and Auto Fix restores it (idempotent, adds only the missing layer).
- An instance that lacks a managed layer its props show is not a Diagnostics finding: the anatomy sync creates it (as it creates a missing icon slot layer), in one undo step with the prop change.
- Auto Fix and the generator never recreate what is intentionally absent: the generator's creation list is the non-managed layers only.

## 3. The state model

- Disabled and Read only: both non-interactive, both the disabled look (done: `stateOn`). Neither is focusable on any surface.
- Disabled with no value shows the placeholder; Read only shows the value, and an empty Read only shows the placeholder (there is no value to show). A value beats the placeholder in both: the `value` layer exists and the placeholder layer is hidden.
- The control in Play and the export reads **props**, not nodes: the `<input>` holds `value` and `placeholder` whether or not a `value` layer exists. The `value` layer is the canvas's drawing of it. So Play and the export need no change for the model; the canvas needs the layer to draw the value.

## 4. Validator, the rename, existing files

- The rule "anatomy needs a required text or control slot" becomes "a required or **primary** slot": the Input's control slot becomes managed (optional on a master), so the rule must accept the `primarySlot` (a managed one allowed) in place of a required text slot. A template still needs one primary layer.
- `primarySlot` is validated: it names an anatomy slot of kind text or control. Button and FormItem declare `primarySlot: 'label'`; no template relies on a default.
- Renaming `label` to `value` changes the Input's anatomy id, display key, `control.slot`, the `value` prop's node key, the class (`.input-value`) and the Play and export strings that say `label`. Button and FormItem keep `label`.
- **What breaks, no shim:** an existing Input master has a `label` layer and the other four; the new template treats them as unknown layers (kept, not recognised), and an instance made before has no managed layers. Existing Inputs must be regenerated (Create Input again; the fixtures and `testing.midas` regenerate with the make scripts). Files with no Input are not affected.

## 5. What it costs (the real size)

It is not a small change; it is the largest of the Input work.

1. A managed text layer needs **instance-level token binding** for its fill and typography (and the disabled colours): the master has no layer to carry the bindings, so the instance's layer is bound to the Input's token variables directly, as `iconSlotBindings` does for the icons. That is new code beside `bindMasterTokens` (which binds the master's root and label).
2. The primary key must be generalised in the engine and the studio (label role key, the Label row, the master/instance label lookup).
3. Every Input surface is touched: canvas structure, the layer panel, the anatomy sync, the binder, Auto Fix, `part-missing`.
4. Input parity: strict-parity and export-parity measure boxes of the layers; the boxes do not move (the same layers draw), but the node structure changes, so `affix`, `input-live` and `parts` browser tests change. Button must not regress: it has no managed text, and `primarySlot: 'label'` keeps its key. These need the browser suite to prove; I cannot run it here.

## 6. Commit plan, staged so that (b) can land first

1. **`primarySlot` (b)**, no behaviour change: the schema field and its validator rule, the engine and studio read the key from it, Button and FormItem declare `label`, Input declares `label` for now. Unit tests; fixtures unchanged. Safe on its own.
2. **Rename `label` to `value` (b)**: Input's anatomy, display, control, node key, class; Play and export strings; the Input tests and fixtures; regenerate. Still all five layers.
3. **Managed text in the schema and validator (a)**: `kind: 'text'` with `managed`, the rule change, tests (negative).
4. **Instance creation and removal (a)**: `instanceOf`, `planInstanceAnatomy` and the studio sync create and remove the managed text layers, in order; remembered content. Unit tests; no template uses it yet.
5. **Instance-level bindings (a)**: fill, typography and the disabled colours for a managed text layer; tests with the Input model.
6. **Switch the Input (c)**: its value, prefix text, suffix text and counter become managed; the master builds the placeholder only; `part-missing` and Auto Fix follow; Play and export checked; fixtures regenerate.
7. Docs and AGENTS.md.

Steps 1 and 2 are independent and can land first; 3 to 6 land together as the feature. Estimate: 1 and 2 about 1.5 days, 3 to 6 about 4 to 5 days, plus the browser suite run and its failures.

## 7. A cheaper option, if the goal is only the layer panel

The goal as stated is a layer panel that shows one text node. If that is all that is needed, a much smaller change reaches it: **engine-owned layers that are hidden are not listed in the layer panel** (a flag on the layer, set by the generator for a layer a condition hides, cleared when it shows). The nodes still exist in the file and on the canvas model; the panel stops listing them while hidden. About half a day, no schema or parity change, but the file still holds the hidden nodes and a designer cannot reach them until a prop shows them. It does not give the "created only when needed" structure.

## 8. Does it conflict with the locked rules?

No locked rule is broken (canvas is the source of truth; Play and the export derive from the same props; no migration shims, old files are regenerated). It is **larger than a fix**: it adds a kind of layer (the managed text layer) and a schema concept (`primarySlot`), and it moves the engine's `label` key. I recommend deciding between the full design (section 6) and the cheap option (section 7) before any code.
