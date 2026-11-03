# Slots (built; the deferred items and the known gaps are at the end)

Status: steps 1 to 8 are done (commits `697291a` to `aaaa8f2`, section 4); what was deferred and what is known to be missing are in section 5, and the manual browser checklist, which nothing automated covers, is in section 6. The audit in sections 0 to 2 is kept as written: where the later sections or the Status paragraphs say otherwise, they win. `docs/behavior-spec.md` stays the source of truth; accepted decisions move there.

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
- **List**: one slot, `item`, repeated `itemCount` times in Play and the export (decisions 4 and 7).

## 3. Decisions (confirmed)

1. `min`, `showEmpty` and `fillCounter` are implemented, and stay in the editor.
2. `accepts` names template ids, not document component ids.
3. Several slots: each has a fixed prop name declared in the schema (`header`, `footer`), not named by the designer. A single slot is `children`.
4. List: the content is authored once on the canvas. The N copies are rendered only in Play and in the export; the canvas does not repeat it (no `itemCount` repeating on the canvas).
5. `onlyAccepts`: blocked in the picker; a warning in Diagnostics for paste, drag and import.
6. A horizontal slot's cross axis fills automatically, as in Figma.

7. List (step 8): the template is one `item` slot that is **min 1 and max 1 on purpose**: a List has one item template, authored once, and it is repeated; this is a decision, not a limitation (a List of different items is several Lists or a Custom template). `repeat` is a generic optional slot field naming a number prop (validated by `slotProblems`); no code in the engine knows about List. The count is the prop clamped to a whole number of 0 or more, and a value that is not finite (not set, null, NaN, Infinity) is the schema's default for the prop, 0 when it has none (`repeatCount`; the generated `copies()` writes the same rule). With no copies the slot is empty and its element follows `showEmpty`. The canvas draws the item once whatever `itemCount` says (0 included): it is where the item is authored. The spacing between copies is the item frame's own auto layout gap (node-owned, not token-bound: content slots have no display mapping). Copies carry no DOM id: neither the export nor Play gives any element an `id`; Play's `data-node-id` names the design node and is the same on every copy (events are dispatched by node, not by element), and a consumer's own `id` in the children is repeated as given, never rewritten.

Naming: "icon slot" and "content slot" in code and docs; they are never merged.

Status: step 1 is done (the pure decisions are in `content-slots.js`, `slot-rules.js` and `slot-property.js`, with unit tests, and the studio calls them; behaviour unchanged). Step 2 is done: `diagnoseSlots` (slot-diagnostics.js) reports `slot-below-min`, `slot-above-max` and `slot-not-accepted` as warnings in `diagnoseDocument`; an instance with no template shows them in its Behavior tab; and `transaction()` shows a notice for what an edit newly broke (paste, drag, duplicate, import, delete). The picker still blocks `max` and `onlyPreferred`; every other path warns. A freshly placed component gets no notice for its own minimum (the Diagnostics still report it).

Step 3 is done: `showEmpty` is effective (an empty slot that does not ask is hidden on the instance, so the canvas layout, Play and the export skip it; off by default, so existing empty slots collapse); `fillCounter` is effective as a one-time write when a component is put into a slot, and a horizontal slot fills its counter axis (the height) on its own; the slot row has Clear and Reset (Reset gives the slot back and the sync copies the main component's content in again). `min` is effective as a warning (step 2). Step 4 is done: a template schema may declare `slots` (the fields in 2.1; `SlotDef` types them) and `validateTemplateSchema` holds each slot to its rules; `accepts` is checked against the registry's template ids (`createTemplateRegistry`, in any order, itself included). Choices the plan left to the validator: `layout` is required (the slot frame is an auto layout and no default is invented); `children`, `className`, `style`, `ref` and `key` are reserved ids (the generated component's own props); a slot id may not be an anatomy slot or part id; `onlyAccepts` needs `accepts`; an unknown field is refused by name. Button and Input declare no slots. Step 5 is partly done: the generator reads `slots` (role `content` in `layerSpecsOf`): `applyTemplateToFrame` makes each slot's frame (auto layout in the schema layout, `propBind.slot` = the slot id) and writes the slot property through `newSlotProp` with the schema's description, limits, `showEmpty` and `fillCounter`; it adds only what is missing, so `part-missing` reports a deleted slot frame and Auto Fix restores it without touching content. `accepts` and `onlyAccepts` are written onto the slot property as the schema names them (template ids, never resolved to document ids), and are read: a candidate's template is its master's `behavior.templateId` (`templateIdsOf`; a set: its variants'), so a copy, a rename, a library snapshot component and the copy a file imports from it all resolve the same (the snapshot clones the nodes, `behavior` included). `slotAccepts(prop, { ids, templates })`, `diagnoseSlots` (`slot-not-accepted`) and the Add instances picker (which blocks) use it. **Precedence** with `preferred`: when `onlyAccepts` is on (with some templates listed) the template contract binds: only a candidate bound to an accepted template is taken, and `preferred` does not widen it. When `onlyAccepts` is off, `preferred`/`onlyPreferred` work as before. A slot that enforces neither takes anything. `onlyAccepts` is the template's: the slot editor has no control for it. Step 5 follow-ups: with `onlyAccepts` on the template contract binds and `preferred` does not widen it (replacing the union described above); a library import remaps a slot property's `preferred` ids (`remapCprops`). Step 6 is done as 2.4 says: a template with `slots` is emitted as a typed `<Name>.tsx` (children or named ReactNode props, `forwardRef`, className/style/rest, a slot element guarded by `filled` unless `showEmpty`, its CSS from the slot frame's auto layout); Button and Input are byte-identical. Step 7 is done except the type check: FormItem is a built-in template (schema only: a label above a `control` slot that accepts Input, one layer min and max, no validation; `accepts` names `select` once that template exists, since the registry refuses an unregistered id), and a Custom template is a schema pasted as JSON, held to the built-in validator plus the Custom rules (`custom-<slug>`), stored in the document as `behavior: { version, templates }`, and read through the one registry (`TEMPLATES` = the built-in templates plus the open document's, filled by `activateDocumentTemplates`, so every call site is unchanged). The schema needed two generic relaxations (a template with no managed icon slot lists no `icons`, and no focus `outline`) and `rootLayout` (seeds a new master's direction, FormItem is vertical). A slotted component is compiled and rendered to HTML in a studio unit test. Not covered: a type check of the generated `.tsx` (no `@types/react` in the repo, so the TSX is only parsed; adding it is a package.json change waiting for a decision), and the studio paths in `midas.js` and `storage.js` (picker, duplicate, save, open, undo, the Apply handler), which have no unit test. Step 7 follow-ups: a real type check of the generated `.tsx` (`@types/react` and `@types/react-dom` 19.3.0 in the studio), which found and fixed the root's element type and its disabled attribute; and the registry changes only where a document is adopted (`withDocumentTemplates` scopes the reading of other data). Step 8 is done: the List template and `repeat` as decision 7 says. Found on the way: Play never drew the content slots of a template instance (renderTemplate drew only the anatomy), so the FormItem's Input and the List's item did not show in Play; it now draws the slot element and the copies. The schema needed one more generic relaxation: a template whose content is a content slot needs no text or control slot in its anatomy. List has no tokens and no variable props; its `disabled` prop only marks the root aria-disabled (the element needs a disabled state). Not covered: the studio paths in `midas.js` and `storage.js`, and Play and the export in a browser. The rest waits for confirmation.

## 4. Steps (small, each keeps the suites green)

Every step was done tests first, in small commits, unit tests only (builder-core and studio). Button and Input output is byte-identical to before the slot work. Commit ranges are in order; a follow-up the user asked for is listed with the step it followed.

| Step | Change | Status | Commits |
|---|---|---|---|
| 1 | Pure `slotAccepts`, `slotCounts`, content vs icon slot naming; unit tests; the studio calls them | Done | `697291a`, `f88545f`, `951d383`, `cf226b5` (docs) |
| 2 | Enforce at every entry (paste, drag, duplicate, import); Diagnostics for min, max, not accepted | Done | `a83d6f0`, `c8d45c0`, `e263b69`, `a09fbd6` (docs) |
| 3 | `showEmpty`, `fillCounter`, Clear and Reset | Done | `b2c7b7e` (follow-up: no minimum notice for a fresh instance), `da35901`, `53788c3`, `423654e`, `2c101cf`, `71698b0` (docs) |
| 4 | Schema `slots` and its validator, negative tests | Done | `446832a`, `d6748d0`, `717ee49` (docs) |
| 5 | Generator: content role, the property, Auto Fix and `part-missing`; `accepts` resolved by template id | Done | `04729de`, `5216d22` (docs), `2fbdd21`, `ff0a084`, `9d9a111`; follow-ups: `30ec8dc` (the template contract binds over `preferred`), `b9bd5c1` (library import remaps a slot's `preferred`) |
| 6 | Export: `children` and named props, typed | Done, for templates with `slots` only (typed `.tsx`); the rest of the step's text moved to section 5 | `17fa263` (docs), `caa7f28`, `9720326` (docs) |
| 7 | FormItem and Custom use it | Done: FormItem (schema only), Custom (pure core, panel box, save, open, undo) | `103c2c2`, `ed7da5d`, `5ea51fe`, `3078aa5`, `2d228e8`, `a372bee`, `7c38cac`, `7013949` (docs); follow-ups: `611fc16` (@types/react), `36d6890` and `13e968d` (real type check, two emitter fixes), `601a23a` and `f68a274` (the registry changes only where a document is adopted) |
| 8 | List repetition | Done | `d6879b4`, `4254679`, `e02e659`, `e38a98e`, `eec3002`, `d2e6019`, `aaaa8f2` (docs) |

Whole range: `697291a` to `aaaa8f2`. Final counts at the end of step 8: builder-core 1216 tests, studio 88 tests, 0 failing. No fixture changed, so none was regenerated.

Risks: the slot code lives in the 22k-line `midas.js`, so step 1 touches a lot of editor paths; `showEmpty`, `fillCounter` and `min` are already in saved files, so turning them on changes how existing files behave (files are regenerated, no shim); and `accepts` needs the template of a candidate's master, which a published library instance must resolve from the library snapshot.

## 5. Deferred and known gaps

### Deferred to the screen emitter

Both belong to `play-from-tsx.md` (the screen emitter, step 5 there); they are not lost and not partly built:

- **Default content as fallback**: a slot with content in the design emits that content as the default when its prop is not passed.
- **Duplicated content emits repeated children in order**: the children of an instance's slot, in canvas order, are the children of the component usage.

### Known gaps

- **Slot content has no display mapping or token binding.** A slot frame's gap, padding and alignment are the master node's own values, not tokens. This is why the List item gap is node-owned (decision 7): the spacing between copies is the item frame's auto layout gap. Binding it to a variable needs a display mapping for content slots (an engine change, not List code).
- **FormItem is schema only.** It has no validation, rules, status (`validateStatus`), help text or required mark; those are the validation work in `play-from-tsx.md` section 6. Its `disabled` only changes the label colour.
- **List is parked.** The planned model is a ListItem template, a List slot that accepts `['list-item']`, and Item count as a sync action on real instances (it replaces `repeat`). The report that Item count is not visible in the Behavior tab has not been investigated yet. The List template, the `repeat` field and the step-8 List code are untouched.
- **FormItem `required`, `layout`, `labelWidth` and `labelGap` are built** (a label box holding the mark and the label; the gap is the `labelGap` prop alone). Still open: an empty control slot is drawn at the canvas floor's height and has none in Play and the export (as every empty slot); the required mark text is a prop (`requiredMark`, default `*`). The rules, status and triggers are designed, not built, in `form-validation.md`. The Input's managed text layers (a fresh Input showing one text node) are designed in `input-managed-text.md`, awaiting a decision.
- **There is no Select template.** The registry refuses an `accepts` id it does not hold, so FormItem's control slot accepts `['input']` only; `select` joins it when the template exists.
- **List `disabled` is aria-only.** The element needs a disabled state, so the root says `aria-disabled`; nothing about the List looks different.
- **Typed output exists only for templates with `slots`.** Button and Input keep their untyped `.jsx` until Phase 3 (`play-from-tsx.md` step 2); variable props are typed `string` until mode names replace ids in the selectors (its step 3).
- **`@types/react` and `@types/react-dom` are 19.3.0 while react is 19.3.1**: the newest the types packages have for 19.3.x.
- **`typescript` and `esbuild` are resolved by hoisting**, not declared in the studio: the type-check and render tests import them from the root `node_modules` (`typescript` is a devDependency of the server, `esbuild` comes with the server and vite). A clean install that stops hoisting them would break those two test files; declaring them is a `package.json` decision not yet taken.
- **The studio code in `midas.js` and `storage.js` has no unit test** (`midas.js` cannot be imported outside a browser). Every checklist item below marked **[no unit test]** rests on code that only a browser run exercises.
- **Play and the export have not been looked at in a browser**, and the browser suite has not been run since the four Input fixes and the slot work (its stale tests and its known failures are in AGENTS.md).

## 6. Manual browser checklist

Run `infra:up` (Docker Desktop on), then `dev:server` and `dev:studio` separately. Ordered by risk: the first items rest on code with no unit test. **[no unit test]** marks an item that touches `midas.js` or `storage.js` paths no automated test covers.

| # | Click | You should see |
|---|---|---|
| 1 | **[no unit test]** In a file, select a plain frame, Behavior tab, Custom template box: paste a FormItem-like schema with id `custom-card`, Apply. Save, close the file, open it again. | A master built from the schema; after reopening, the Template dropdown still lists Card and the master is still bound to it. |
| 2 | **[no unit test]** After 1, Ctrl+Z, then Ctrl+Shift+Z. | Undo: the Card template and its master changes are gone from the dropdown; redo brings them back. |
| 3 | **[no unit test]** Open file A (it has Custom templates), then file B (none). Then open A again. | B's Template dropdown lists only Button, Input, FormItem and List; A's lists Card again. Switching never carries a template across. |
| 4 | **[no unit test]** In A, try to open a file that is broken (a hand-edited file with a bad `behavior` key). | An explicit error toast, no partial load; A stays open with its own Custom templates in the dropdown. |
| 5 | **[no unit test]** In A (with Card), copy plain layers and paste them; then copy a Card instance and paste it; then paste a Card instance copied from a file with a different Custom template. | Plain layers paste; the Card instance pastes (its template belongs to A); the foreign one is refused with an explicit message, and Card is still in the dropdown afterwards. |
| 6 | **[no unit test]** Custom box: Apply an invalid schema (bad JSON; an id without `custom-`; `accepts` naming `select`). Then edit an applied schema so it drops a prop some instance has a value for. | The problems as rows under the box and nothing stored; for the edit, "prop … is removed, and N instances hold a value for it" and nothing changed. |
| 7 | **[no unit test]** Assets panel: Create FormItem, Create List. | Each makes a master and one instance; the instance's Behavior tab lists Size, Label, Disabled (FormItem) and Item count, Disabled (List); the slot shows its box and "+". |
| 8 | **[no unit test]** FormItem instance: click "+" in the Control slot; try the file and a library as sources; with an Input in the file and a Button. Then paste or drag a Button into the slot. | The picker lists only components whose master is an Input (also from a library); a second layer is blocked in the picker (max 1); the pasted Button is allowed, with a toast, and the Diagnostics show `slot-not-accepted`. |
| 9 | **[no unit test]** Duplicate the Input component, and rename it; use each in the slot again. | Both still qualify (the template is the master's binding, not the id or the name). |
| 10 | **[no unit test]** Publish a library that has a component with a slot whose preferred components are set; add that library to another file and open the slot's editor there. | The preferred components are listed by name (their ids were remapped on import), not as unknown ids. |
| 11 | Clear the slot of a FormItem instance; then Reset it; repeat with a slot that has `showEmpty` off. | Clear: the slot shows its empty box (showEmpty on) or takes no room (off) and the layout closes the gap; the Diagnostics show `slot-below-min`; Reset gives back the master's content. |
| 12 | Put a component in a vertical and in a horizontal slot (`fillCounter`). | It fills the slot's counter axis once (a horizontal slot always does); resizing it afterwards is not undone. |
| 13 | Delete the slot frame in the FormItem master; open Diagnostics; Auto Fix. | `part-missing` for the control layer; Auto Fix restores the frame and its property, leaves other slot content alone, in one undo step. |
| 14 | Play a frame that holds a FormItem with an Input in its slot. | The label above the Input, the Input drawn (this was missing before step 8); an empty slot with `showEmpty` off takes no room. |
| 15 | List instance with a component in `item`: set Item count to 3, 5, 0, 2.9, -1. Play it. Set the gap of the Item frame on the master to 12. | The canvas shows the item once at every count; Play shows 3, 5, 0, 2, 0 copies; with 0 the item area is empty; the copies are 12 apart. |
| 16 | Put two components in the List's `item` slot. | A warning (max 1); the Diagnostics show `slot-above-max`. |
| 17 | Generate code on the FormItem master, the List master and a Custom master. | `FormItem.tsx` + `.css`, `List.tsx` + `.css`, `Card.tsx` + `.css`. Dropped into a React 19 project with a TypeScript build, they compile and render as the unit tests say (children, named slots, `itemCount` clamped). |
| 18 | Create Button and Create Input; look at them on the canvas and in Play; change variant, size, state. | Nothing changed since before the slot work (the unit suites say the output is byte-identical; the browser suite has not run). |

After the checklist, the next piece of verification is the browser suite itself (`npm run test:browser --workspace @midas/studio`, ports 4000 and 5174 free first): its stale tests and its known failures are in AGENTS.md.
