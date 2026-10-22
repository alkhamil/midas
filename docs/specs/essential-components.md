# Essential Components for the Behavior Tab

The Behavior tab is contextual and works at any level, including nested instances. Selecting a main component, an
instance, or a nested instance shows its own Behavior. An instance uses its own `stateMapping`, `stateModes` and
`interactions`; when they are empty it falls back to its component set / main component.

No state is hardcoded. Every state value is read from a variable collection where **mode = state**. Collection names and
modes below are the ones of the token file (`token_2.json`).

Canonical model: `packages/builder-core/src/behavior.js`. How the tab works in detail: [behavior-tab.md](behavior-tab.md).

## A. Already there (reuse, do not rebuild)

1. **Placement + offset** — `top-start … left-end` and an offset in px, for Open dropdown, Open overlay (position) and
   Open popover / tooltip.
2. **Swap icon for Password** — two icon components (*Icon while hidden*, *Icon while shown*); the instance in the field
   that matches one of them is swapped on click.
3. **Hover popover / tooltip** — a layer opened on hover closes when the pointer leaves both the trigger and the layer, and
   does not stack when the trigger is redrawn.

## B. Built from the token

| Item | Status |
|---|---|
| States from the token (`selected` = checked / open / current, `indeterminate`, `disabled-off` / `disabled-on`, `focused-selected` / `focused-indeterminate`, `error-empty` / `error-filled`, `read-only`, `active`, `inactive`, …) | Done. Every one is a state a mode can be named after; the panel lists the states of the connected collection. |
| Fallback chains (`pressed → hover → default`, `error-* → error → default`, `focused-selected → focused → selected → default`, `selected → focused → default`) | Done. |
| Preview *enters* `selected`, `selected-hover`, `focused-selected`, `disabled-on` / `-off`, `error-empty` / `error-filled`, `indeterminate` (flag) | Done for the ones driven by pointer, focus, typing, validation, disabled and *Set active / selected*. |
| States Preview does not enter by itself: `loading`, `success`, `today`, `filtered`, `uploading`, `uploaded`, `destructive`, `upcoming`, `completed`, `active`, `inactive`, `empty` | Mappable in the panel and used through the fallback chain; nothing in Preview switches to them yet. |
| Action **Set variable** | Done. Layers bound to the variable are drawn with the value while Preview is open. |
| Action **Set active / selected** | Done: Toggle, Select, Select only this one. |
| **Several actions per trigger**, run in order | Done. |
| **Close on outside click / Escape** | Done for dropdown and popover (outside click) and for every layer (Escape, topmost first). An overlay closes on outside click only when *Close when the backdrop is clicked* is on. |
| Validation trigger | Done: *Validate* = On blur / On change / On submit (Enter). |

## C. Panel structure

The panel holds, from the top: **This component**, **This layer is**, **Typeable area** (only for fields),
**State mapping** (collapsible, closed by default), **Interaction**. There is no Label, no Error handling, no Placeholder
and no *Value binds to*: they live in the Appearance tab (through variables), and how an error looks comes from
State mapping.

1. **State mapping** — connect a collection named `<Component> states`; each state shows a mode dropdown (`Automatic`
   guesses from the mode name; the pick is stored in `stateModes`). Values come from `vars` + `varModes`; `stateMapping`
   only holds overrides.
2. **Interaction** — *+ Add interaction* → trigger, then one or more actions.
   - Triggers: On click, On hover / On mouse enter, On focus / On blur, On change / On submit.
   - Actions: Navigate · Open dropdown · Open overlay · Open popover / tooltip · Close overlay · **Set variable** ·
     **Set active / selected**.
3. **Validate** (fields) — when the field is checked, and it always ends as a state: `error-empty` for a required empty
   field, `error-filled` for text that does not fit the type.

## D. Essential components (exact collections and modes)

| Component | Collection | Modes |
|---|---|---|
| Button | `Button states` | default, pressed, disabled, hover, focused |
| Input Field | `Input states` | default, selected, typing, filled, disabled, error-empty, error-filled, read-only, focused |
| Textarea | `Textarea states` | default, focus, typing, filled, disabled, error-empty, error-filled, read-only, focused |
| Select | `Select states` | default, selected, filled, disabled, error-empty, error-filled, read-only, focused |
| Search Field | `Search bar states` | default, selected, typing, filled, disabled, focused |
| Checkbox | `Checkbox states` | default, selected, indeterminate, disabled-off, disabled-on, error, focused, focused-selected, focused-indeterminate |
| Radio | `Radio btn states` | default, selected, disabled-off, disabled-on, error, focused, focused-selected |
| Switch / Toggle | `Toggle states` | default, selected, disabled-off, disabled-on, error, focused, focused-selected |
| Breadcrumbs | `Breadcrumbs states` | default, hover, pressed, active, disabled |
| Link | `Link states` | default, pressed, disabled, hover, focused |
| Navigation | `_Navigation states` | inactive, active |
| Nav item | `Nav item states` | default, hover, focused, current, current-hover, current-focused |
| List item / Card | `List item states` | default, pressed, selected, disabled |
| Dropdown menu | `Dropdown styles` | default (style only) |
| Menu item | `Menu item states` | default, pressed, selected, disabled, destructive |
| Table row | `Table row states` | default, hover, selected, disabled, loading, error |
| Table cell | `Table cell states` | default, hover, selected, disabled, loading, error, focused |
| Table header | `Table header states` | default, disabled |
| Table toolbar | `Table Toolbar states` | default, filtered |
| Accordion | `Accordion states` | default, pressed, disabled, hover, focused |
| OTP / PIN | `OTP states` / `PIN states` | empty, filled, error, success |
| Date picker | `Date Picker states` | default, selected, filled, disabled, error-empty, error-filled, read-only, focused |
| Day cell | `Day cell states` | default, selected, today, disabled, empty |
| File upload area | `File Upload Area states` | default, focused, hover, disabled, error |
| File upload card | `File Upload Cards states` | uploading, uploaded, error, filled, disabled, focused |
| Slider | `Slider states` | default, pressed, disabled |
| Step | `Step states` | upcoming, current, completed, error |
| Profile | `Profile states` | default, hover, active |
| QS control | `QS control states` | default, disabled |
| Dialog / Tooltip / Popover | `Dialog styles`, `Tooltip styles`, `Popover styles` | style only; open / closed is an interaction |

How the pieces are used:

- **Button** — connect the collection, map fill / text / border per mode. *On click → Navigate / Open overlay*. A nested
  icon can have its own mapping.
- **Input Field** — State mapping only. `error-empty` for a required empty field, `error-filled` for an invalid one.
  Pick the typing layer, the input type and *Validate* in Typeable area.
- **Select** — `selected` and `filled` both mean "has a value". *On click → Open dropdown*.
- **Checkbox / Radio / Toggle** — `selected` is checked / on. *On click → Set active / selected* (Toggle for a checkbox
  or switch, Select only this one for a radio group). Add *Set variable* to record the value.
- **Menu item** — *On click → Close overlay, Set variable, Navigate* (several actions).
- **Tabs / Nav items / rows** — *On click → Set active / selected → Select only this one* switches the siblings of the same
  component off.
- **Containers** (Dropdown menu, Modal, Popover, Tooltip) are the target of an Open action; their children carry the
  behavior.

## E. Nested instance rules

1. Any layer inside a component can be selected as a nested instance.
2. A nested instance has its own `stateMapping`, `stateModes` and `interactions`; when empty it inherits from its main
   component.
3. Example: an icon inside a button can override its fill for `hover`.
4. In Preview a click runs the interaction of the innermost layer that has one for that trigger; the layers around it only
   get their state back.

## F. Data model

```json
{
  "varModes": { "button-states": "default" },
  "vars": { "fill": "button-fill" },
  "stateModes": { "input-states": { "error-empty": "mode-error-empty" } },
  "stateMapping": {
    "hover": { "fill": { "collectionId": "button-states", "variableId": "button-fill-hover" } }
  },
  "interactions": [
    { "id": "i1", "trigger": "onClick", "actions": [
      { "type": "close-overlay", "close": "current" },
      { "type": "set-variable", "variableId": "checked", "value": true },
      { "type": "set-selected", "mode": "toggle" },
      { "type": "navigate", "targetFrameId": "dashboard" }
    ] }
  ],
  "inputBehavior": {
    "typeable": { "frameId": "input-box", "inputType": "email" },
    "validation": { "required": true, "trigger": "blur" }
  }
}
```

There is no `inputBehavior.label`, `placeholder`, `error.frameId` or *value binds to*: label, placeholder and value live in
Appearance. Files that still hold them are read without them.

## G. Preview runtime

- The state is resolved through the fallback chain per property; what is drawn is the base state combined with what stays
  on the layer (selected, indeterminate, an empty value).
- A trigger runs its actions in order. The innermost layer with an interaction for the trigger wins.
- Escape closes the topmost overlay / dropdown / popover, then the preview menu, then leaves Preview.

## H. Checklist for UI/UX

1. Use the exact collection name and modes of the token.
2. Bind Label, Placeholder and Value in the Appearance tab, not in Behavior.
3. In the Behavior tab only connect the state collection and add interactions (including Set variable / Set active).
4. For input-like components set *Validate*; the error look is the `error-empty` / `error-filled` mode, not a manual frame.
