# FormItem rules and validation (design only)

Status: design. **Nothing here is built.** The runtime waits for Play from TSX (`play-from-tsx.md`): the rules run in the generated component, so they need the component runtime (`runtime.tsx`) and the iframe Play that executes it. The order is locked: regression fixes, Play from TSX, Custom, validation. This document only fixes the shape so the data can be designed once. It extends `play-from-tsx.md` section 6 and keeps to `slots.md` (FormItem is a template with one content slot, `control`).

## 1. Rules are data

A FormItem has a `rules` prop: a list of rule objects, stored as data on the instance (an array of plain objects, edited as rows in the Behavior panel, one row per rule). A rule is one check and the message shown when it fails:

| Rule | Fields | Fails when the control's value |
|---|---|---|
| required | `{ required: true, message }` | is empty (an empty string, or no value) |
| min | `{ min: n, message }` | is shorter than `n` characters (a number control: smaller than `n`) |
| max | `{ max: n, message }` | is longer than `n` characters (a number control: larger than `n`) |
| pattern | `{ pattern: '<regular expression source>', message }` | does not match the expression |

- `message` is plain text, required on every rule; the validator refuses a rule without one.
- A rule is data, never code: `pattern` is the source of a regular expression, compiled by the runtime with a fixed set of flags; a schema or an instance holds no function.
- Rules run in order; the first one that fails gives the status and the message (antd runs all and shows the first by default; one is enough here and stops a second message from fighting the first).
- The same rule objects are what the Input's own constraints (`minLength`, `maxLength`, `type`) already say as attributes; rules do not replace them, they are the FormItem's check of what the control holds.

## 2. validateStatus reaches the control

`validateStatus` is the FormItem's result: `default | error | warning | success | validating`. It is passed to the control through a **context**, as antd passes `FormItemInputContext`, not by prop drilling, so any control inside the `control` slot can read it:

- The control reads the context and takes the matching mode of its own **Status** collection (the Input already has Input Status: default, error, warning): its `data-status` follows the context, so its border and outline colours change by the rules the Input already has. A control with no Status collection ignores it.
- The FormItem shows the `message` under the control (a help text, in a part of the template that appears only while there is a message). The message and the status are the only output of validation.
- `validateStatus` is also settable by hand on the instance, so a designer can draw an error or warning state on the canvas without running anything.

## 3. Triggers

`validateTrigger` is a list of when the rules run: `change` (the control's value changed), `blur` (the control lost focus) and `submit` (the form is submitted). Default `['change']`.

- On a trigger the runtime reads the control's current value, runs the rules, and sets `{ status, message }` in the FormItem's state; the context carries it down.
- `submit` runs every FormItem of the frame that holds the submit trigger (a Button inside a frame with FormItems); navigation from that trigger runs only when all pass. A new destination for "submit invalid" is out of scope until asked.
- Before the first trigger the FormItem is `default` with no message (nothing is validated on first render).

## 4. What the canvas does

Static only. No rule runs on the canvas: `validateStatus` and the help text on the instance draw the error or warning look the designer set, and that is all. Validation is a Play and export behaviour.

## 5. Open points for when it is built

- Where the control's value comes from in the runtime (a control inside the slot is any instance): a small contract, the control registers a getter with the FormItem through the same context, so the FormItem never reads the DOM.
- Whether a rule may name another field (cross-field rules): not designed; out of scope.
- Localised messages: not designed; messages are the text the designer typed.
