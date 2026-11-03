# Slots (audit and design, not implemented)

Status: audit and proposal for review. No product code changed. `docs/behavior-spec.md` stays the source of truth; accepted decisions move there.

Goal: a component whose content is other components (Custom, FormItem, Form, Card, Modal, List) declares **content slots** in its template schema. On the canvas a slot is Figma's slot; in Play and the export it is React children.

## 0. Two things called "slot" today

| | Managed icon slot | Content slot (component property) |
|---|---|---|
| Marker | `behavior: { slot }` on an instance layer | `propBind.slot` on a frame inside the main component; a `cprops` entry `{ type: 'slot' }` on the holder |
| Declared by | the template (`anatomy` managed, `icons`) | the designer (Convert to slot, Ctrl+Shift+S) or a Figma import |
| Content | one swapped icon, bound to `iconSize` and `fg` | any layers, free |
| Owner of the layer | the engine (guards refuse delete, move, paste alone) | the instance (`slotOwned`) |
| Code | `packages/builder-core` (pure, tested) | `apps/studio/src/engine/midas.js` only (22k lines, **no unit test**) |

The plan keeps both and never merges them: the icon rules (fixed, `iconSize`, `fg`) apply only to template-owned parts, never to content slots. In code and docs say "icon slot" and "content slot".

## 1. Audit: what Figma's slot behaviour needs, and what exists

| Behaviour | Where it is now | Verdict |
|---|---|---|
| Frame becomes a slot, auto layout, free multiple content | `canBeSlot`, `convertToSlot`, `holderForLayer` (midas.js ~15405) | Exists, needs auto layout checked |
| Name | `cprops` name, unique per holder | Exists |
| Description | `desc` in the slot property editor | Exists |
| Preferred instances, only allow preferred | `preferred`, `onlyPreferred`; only the **Add instances picker** honours it (`restrict`) | **Half**: paste, drag and import ignore it |
| Min and max layers | `min`, `max` stored; only `max` checked, in `addInstanceToSlot` | **Half**: min never checked, max not checked on paste, drag, duplicate |
| Display empty slot | `showEmpty` stored | **No effect**: nothing reads it |
| Fill container by default (counter axis) | `fillCounter` stored | **No effect**: nothing reads it |
| Cross-axis fill for a horizontal slot | not implemented | Gap |
| Clear / reset slot | no control; `slotOwned` has no reset | Gap |
| Pink box, "+" on the auto layout axis side (vertical: bottom, horizontal: right), empty placeholder | `drawSlots` (midas.js ~10924): outline when selected or hovered, placeholder and "+" when empty | Exists, matches the wanted behaviour |
| Add instances picker (file and libraries) | `openAddInstances`, `addInstanceToSlot` | Exists |
| Instance keeps what it put in the slot | `slotOwned`, skipped in the sync copy loop | Exists |
| Instance row in the Design panel ("Add instances") | `instancePropsHtml` `data-slot-add` | Exists |
| Figma import | `CPROP_TYPES.SLOT`, `PROP_FIELD.SLOT_CONTENT_ID` | Exists |
| Declared by a **template schema** | nothing | Gap (the new part) |
| Code (React children) | the old library packager turns instances into `children` (`component-codegen.js` `opts.slot`); the template emitter (`codegen.js`) has no slot kind | Gap |
| Play | `dom-tree.js` draws any frame's children, so slot content already draws | Works for free, untested |
| Validation | none for content slots (the only slot rules are for icon slots in `document-check.js`) | Gap |

Findings that shape the design:

1. **Three options exist and do nothing** (`min`, `showEmpty`, `fillCounter`). They are in the editor and the file, so they look supported. Decide: implement them or remove them from the editor.
2. **All slot logic is in `midas.js`**, so none of it can be unit-tested or reused by the generator. Any slot work starts by moving the pure decisions into core.
3. The instance anatomy planner keeps every child that is not an icon slot (`slot === null`), so a content slot frame inside a template instance survives anatomy sync and the managed-layer load check. No change needed there.
4. `fixBoundAxes`, `iconBoundKeysOf` and the icon bindings iterate what the template declares, so slot **content** is untouched by them. Nothing to guard.

## 2. Proposal

### 2.1 Schema: `slots` on the template

A template declares its content slots as data. The names and settings are the Figma ones, so the generator can write them into the existing slot property.

```json
"slots": [
  {
    "id": "content",
    "name": "Content",
    "description": "The control this item labels",
    "min": 1,
    "max": 1,
    "accepts": ["input", "select"],
    "onlyAccepts": true,
    "showEmpty": true,
    "fillCounter": true,
    "layout": "vertical"
  }
]
```

- `accepts` names **template ids**, not document ids: a candidate qualifies when it is an instance of a master bound to one of those templates (or, for a plain component, by `preferred` as today). A document id would break on copy, library publish and rename.
- The validator checks: unique ids, `min <= max`, `accepts` names registered or document templates, `layout` is `horizontal` or `vertical`, and a slot is not named like a prop.

### 2.2 Generator

`layerSpecsOf` gains a role `content` (a frame with auto layout, marked with `propBind.slot`) next to `slot` (icon) and `part`. `applyTemplateToFrame` creates it on the master, creates the matching `cprops` entry from the schema, and on the next run only adds what is missing (so `part-missing` covers it, and Auto Fix repairs it). It never removes user content.

### 2.3 Behaviour that must be real, in core

Move into `packages/builder-core` as pure functions with tests, then call them from the studio:

- `slotAccepts(slot, candidate)`: preferred and `accepts` rules, for **every** way content enters (picker, paste, drag, duplicate, import).
- `slotCounts(slot, n)`: below min, above max.
- Diagnostics `slot-below-min`, `slot-above-max`, `slot-not-accepted` (warnings: the designer can still do it, the file says so).
- `showEmpty`: the empty placeholder shows only when set; `fillCounter`: new content in the slot takes `fill` on the slot's counter axis (an explicit, one-time write at insertion, not a standing rule, as Figma).
- Reset slot: drop the instance's override (`slotOwned` off) and re-copy the master's default content, one undo step.

### 2.4 Play and export

- Play: unchanged for content (already drawn). The instance's `slotOwned` content is what draws.
- Export (step 6): the template emitter (`behavior-engine/codegen.js`) writes the component only. A template that declares `slots` is emitted as `<Name>.tsx` with typed props (the conventions of `play-from-tsx.md` 2.1: `forwardRef`, `className` merged after the template class, `style`, rest props spread on the root, `ref` on the root); a template without slots keeps its untyped `<Name>.jsx`, byte for byte, until Phase 3 moves every template to TSX. One slot is `children: ReactNode`; several are named `ReactNode` props with the slot's schema `id` (`header`, `footer`). The slot element is a layer of the component: it is emitted when its prop holds something, or always when the slot has `showEmpty` (empty), so an empty slot without `showEmpty` takes no room, as on the canvas and in Play. Its CSS comes from the slot frame's own auto layout (`flexOf`, `flowSizing`), the rules the canvas uses. A variable prop is typed `string` (the mode id the stylesheet selects); `play-from-tsx.md` narrows it to the mode names when its selectors move from ids to names.
- Not used: the old library packager (`library/component-codegen.js`, `library-behavior.js`) is a separate path that is retired by `play-from-tsx.md`; the slot work neither uses nor extends it.

#### Deferred to the screen emitter

No screen emitter exists yet (`play-from-tsx.md` 2.2, a frame as `Frame<Name>.tsx` with instances as component usages), and the template emitter does not write the use of a component. These two are therefore not step 6; they arrive with the screen emitter and must not be lost:

- **Default content as fallback**: a slot with content in the design emits that content as the default when its prop is not passed.
- **Duplicated content emits repeated children in order**: the children of an instance's slot, in canvas order, are the children of the component usage.

### 2.5 Panels

- Canvas: unchanged (pink box, "+" on the axis side, empty placeholder).
- Design panel (instance): the existing "Add instances" row stays; it is Figma's.
- Behavior panel: **no slot controls and no drop zones**, as decided. A slot is not a Behavior prop.

### 2.6 The templates that use it

- **Custom**: slots come from the pasted schema (`slots`), so a document can define them without code.
- **FormItem**: one slot, `accepts: ["input", "select"]`, extendable by the schema.
- **Form, Card, Modal**: one or more named slots (`header`, `body`, `footer`).
- **List**: one slot, content duplicated per item. Open decision below.

## 3. Decisions (confirmed)

1. `min`, `showEmpty` and `fillCounter` are implemented, and stay in the editor.
2. `accepts` names template ids, not document component ids.
3. Several slots: each has a fixed prop name declared in the schema (`header`, `footer`), not named by the designer. A single slot is `children`.
4. List: the content is authored once on the canvas. The N copies are rendered only in Play and in the export; the canvas does not repeat it (no `itemCount` repeating on the canvas).
5. `onlyAccepts`: blocked in the picker; a warning in Diagnostics for paste, drag and import.
6. A horizontal slot's cross axis fills automatically, as in Figma.

Naming: "icon slot" and "content slot" in code and docs; they are never merged.

Status: step 1 is done (the pure decisions are in `content-slots.js`, `slot-rules.js` and `slot-property.js`, with unit tests, and the studio calls them; behaviour unchanged). Step 2 is done: `diagnoseSlots` (slot-diagnostics.js) reports `slot-below-min`, `slot-above-max` and `slot-not-accepted` as warnings in `diagnoseDocument`; an instance with no template shows them in its Behavior tab; and `transaction()` shows a notice for what an edit newly broke (paste, drag, duplicate, import, delete). The picker still blocks `max` and `onlyPreferred`; every other path warns. A freshly placed component gets no notice for its own minimum (the Diagnostics still report it).

Step 3 is done: `showEmpty` is effective (an empty slot that does not ask is hidden on the instance, so the canvas layout, Play and the export skip it; off by default, so existing empty slots collapse); `fillCounter` is effective as a one-time write when a component is put into a slot, and a horizontal slot fills its counter axis (the height) on its own; the slot row has Clear and Reset (Reset gives the slot back and the sync copies the main component's content in again). `min` is effective as a warning (step 2). Step 4 is done: a template schema may declare `slots` (the fields in 2.1; `SlotDef` types them) and `validateTemplateSchema` holds each slot to its rules; `accepts` is checked against the registry's template ids (`createTemplateRegistry`, in any order, itself included). Choices the plan left to the validator: `layout` is required (the slot frame is an auto layout and no default is invented); `children`, `className`, `style`, `ref` and `key` are reserved ids (the generated component's own props); a slot id may not be an anatomy slot or part id; `onlyAccepts` needs `accepts`; an unknown field is refused by name. Button and Input declare no slots. Step 5 is partly done: the generator reads `slots` (role `content` in `layerSpecsOf`): `applyTemplateToFrame` makes each slot's frame (auto layout in the schema layout, `propBind.slot` = the slot id) and writes the slot property through `newSlotProp` with the schema's description, limits, `showEmpty` and `fillCounter`; it adds only what is missing, so `part-missing` reports a deleted slot frame and Auto Fix restores it without touching content. `accepts` and `onlyAccepts` are written onto the slot property as the schema names them (template ids, never resolved to document ids), and are read: a candidate's template is its master's `behavior.templateId` (`templateIdsOf`; a set: its variants'), so a copy, a rename, a library snapshot component and the copy a file imports from it all resolve the same (the snapshot clones the nodes, `behavior` included). `slotAccepts(prop, { ids, templates })`, `diagnoseSlots` (`slot-not-accepted`) and the Add instances picker (which blocks) use it. **Precedence** with `preferred`: when `onlyAccepts` is on (with some templates listed) the template contract binds: only a candidate bound to an accepted template is taken, and `preferred` does not widen it. When `onlyAccepts` is off, `preferred`/`onlyPreferred` work as before. A slot that enforces neither takes anything. `onlyAccepts` is the template's: the slot editor has no control for it. Step 5 follow-ups: with `onlyAccepts` on the template contract binds and `preferred` does not widen it (replacing the union described above); a library import remaps a slot property's `preferred` ids (`remapCprops`). Step 6 is done as 2.4 says: a template with `slots` is emitted as a typed `<Name>.tsx` (children or named ReactNode props, `forwardRef`, className/style/rest, a slot element guarded by `filled` unless `showEmpty`, its CSS from the slot frame's auto layout); Button and Input are byte-identical. Not covered: a type check (no `@types/react` in the repo; the TSX is only parsed), and the picker and duplicate of a component in the studio. The rest waits for confirmation.

## 4. Steps (small, each keeps the suites green)

| Step | Change | Size |
|---|---|---|
| 1 | Pure `slotAccepts`, `slotCounts`, `iconSlot` vs `contentSlot` naming; unit tests; the studio calls them in `addInstanceToSlot` and the picker | S (1 d) |
| 2 | Enforce at every entry (paste, drag, duplicate, import); Diagnostics for min, max, not accepted | M (2 d) |
| 3 | `showEmpty`, `fillCounter`, reset slot | S (1 d) |
| 4 | Schema `slots` and its validator, negative tests | S (1 d) |
| 5 | Generator: content role, the property, Auto Fix and `part-missing` | M (2 d) |
| 6 | Export: `children` and named props, typed | M (2 d) |
| 7 | FormItem and Custom use it (`play-from-tsx.md` step 8 for Custom) | M (2–3 d) |
| 8 | List repetition (after decision 4) | M (2 d) |

Risks: the slot code lives in the 22k-line `midas.js`, so step 1 touches a lot of editor paths; `showEmpty`, `fillCounter` and `min` are already in saved files, so turning them on changes how existing files behave (files are regenerated, no shim); and `accepts` needs the template of a candidate's master, which a published library instance must resolve from the library snapshot.
