# Play from TSX (design, not implemented)

Status: proposal for review. Nothing here is built. `docs/behavior-spec.md` stays the source of truth; once this is accepted, its decisions move there.

Goal: the canvas node tree becomes React TSX in an antd-like shape (a component, typed props, CSS variables). Play runs that same TSX, so Play and the export are the same code by construction. The canvas keeps its own draw calls and stays the source of truth; canvas-vs-Play parity tests stay.

## 0. What Phase 0 changed that this plan builds on

- Fill, stroke style and auto layout alignment now come from shared mappers that Play and the export both read (`dom-tree.js` fill/stroke layers, `layout.js` for the nine alignments, `codegen.js` `strokeRules`/`lineStyleOf`). Step 1 moves the node-style part of them to `node-style.js` unchanged.
- The anatomy order of managed slots has one helper (`indexAmongLaterSlots`) used by the editor's plan and the generator; the screen emitter must read the instance's layers in canvas order, never re-derive an order.
- `rootAlign` only seeds a new master. The TSX reads the node's own alignment.

## 1. Audit (code as it is on feat/fahmi)

| Area | File(s) | What it does today | Verdict |
|---|---|---|---|
| Component codegen | `behavior-engine/codegen.js` (326 lines) | Template + binding + variables → `<Name>.jsx` (string-built JSX, untyped destructured props, no `className`/`style`/`ref`/rest) and `<Name>.css` (one block per mode combination, state blocks, `::before` stroke, `::after` wave). | **Reuse and extend.** Stays the one component emitter; gains TSX, a `Props` type, pass-through props and component behaviour (section 3). |
| Stylesheet | `codegen.js` `stylesheet`, `displayRules`, `strokeRules`, `waveRules`; `preview.js`, `tokens.js` | CSS variables per mode and state from the same resolver as the Preview panel. | **Reuse as is.** Play already loads this stylesheet. |
| Shared layout | `behavior-engine/layout.js` (`flexOf`, `flowSizing`, `rootLayoutOf`, `labelLayoutOf`) | Canvas auto layout as flex, used by Play and codegen. | **Reuse.** Both emitters keep calling it. |
| Play DOM builder | `prototype/dom-tree.js` (753 lines) | Frame → element descriptors. Plain nodes: style mapping (fills, radius, effects, strokes as SVG/CSS, placement, masks). Template instances: `renderTemplate` rebuilds the component's DOM by hand (input, count, clear, spinner, overlays). | **Split.** The node → CSS mapping (`fillStyle`, `radiusStyle`, `effectStyle`, `strokeOverlay`, `placement`, mask clip) moves to a pure `node-style.js`, reused by the screen emitter. `renderTemplate` is **replaced** by a component usage (`<Button … />`). The descriptor tree is **replaced** by screen TSX. |
| Play host | `apps/studio/src/engine/play.js` (550 lines) | Mounts descriptors as real DOM in an overlay, binds events to the player, live Input patches (typing, clear click, count), wave trigger, scaling modes, chrome. | **Keep the chrome and player wiring; replace the mount.** The overlay hosts a sandboxed iframe; live patches move into the generated components and are deleted here. |
| Player / flow | `prototype/player.js`, `plan.js`, `events.js`, `conditional.js`, `viewport.js`, `validate.js` | Flow graph, history, triggers, transitions, scaling. | **Keep, parent side.** The iframe reports triggers; the player decides navigation. |
| Registry | `behavior-engine/registry.js` (`TEMPLATES`, built-in Button and Input) | Validated code-shipped schemas. | **Extend.** A document registry merges built-in and document-stored (Custom) schemas through the same validator. Every `TEMPLATES.get` call site moves to the document registry. |
| Schema validation | `behavior-engine/validate-schema.js` | Refuses a broken schema. | **Reuse** for Custom schemas, plus Custom-only rules (id namespace, no code). |
| Generator | `template-master.js`, `auto-fix.js`, `bind-tokens.js`, `anatomy.js`, `scripts/generated-part.mjs` | Builds masters, collections, bindings, parts; idempotent. | **Reuse** for Custom templates unchanged (they are schema-driven already). |
| Play-only list | `templates/button.js` and `input.js` `playOnly` | Declares what Play draws with no canvas node (hover, active, focus ring, wave, spin, loading click, caret, typing, validation). | **Repurpose.** Each entry names the component behaviour that implements it (section 3); the validator requires that mapping. |
| Library package | `library/component-codegen.js`, `library-behavior.js` (608 lines), `screen.js`, `tailwind.js` | A second, older emitter: any component → TSX + Tailwind, plus hand-made behaviour kits matched by component name (Select, Tabs…). | **Conflict, needs a decision.** Hand-made kits are per-component code, which AGENTS.md forbids in the engine. Proposal: template-bound components export through the template emitter; plain components keep `screen.js` until the screen emitter (step 5) replaces it; the kits are dropped when their templates exist. |
| Parity tests | `strict-parity`, `export-parity`, `play-dark-corners`, `parts`, `icon-states` (browser) | Canvas vs Play geometry; export vs Play boxes. | **Keep canvas vs Play** as the gate. Export vs Play becomes identity after the switch; it is kept during migration as the strangler guard, then reduced to a smoke test. |

## 2. Architecture

```
canvas nodes ──► node-style.js (pure node → CSS) ─┐
                                                  ├─► screen emitter: Frame.tsx (plain nodes as elements, instances as <Button …/>)
templates + bindings ──► component emitter ───────┘   component emitter: Button.tsx + Button.css (+ shared runtime.tsx)
                                   │
                   ┌───────────────┴────────────────┐
              Export / publish                     Play
     esbuild bundle + tsc --noEmit         Sucrase strips types and JSX in a sandboxed iframe;
     (type check only here and in CI)      React from the studio bundle; no type check
```

### 2.1 Component TSX (requirement 1)

One file per template, generated from the schema; no per-component code in the engine.

```tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'solid' | 'outlined' | 'dashed' | 'filled' | 'text' | 'link'; // the bound collection's mode names
export type ButtonColor = 'default' | 'primary' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'children'> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
  label?: string;
  loading?: boolean;
  hasIcon?: boolean;
  iconPlacement?: 'start' | 'end';
  icon?: ReactNode;           // a slot: any node, the icon component by default
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'solid', color = 'primary', size = 'md', label = 'Button', loading = false, className, style, onClick, ...rest }, ref) {
  …
  return <button ref={ref} className={cx('button', className)} style={style} data-variant={variant} … {...rest}>…</button>;
});
```

- Types come from the schema: a variable prop is a union of its collection's mode names; a literal prop is its type (`string`, `number | null`, `boolean`); a string enum prop (`iconPlacement`) is its union; a slot is `ReactNode`; an `iconComponent` prop is `ReactNode`. Defaults are the schema defaults (`defaultMode`, else the first mode).
- `className` merges after the template class; `style` and the rest props spread on the root; `ref` is forwarded to the root (`forwardRef`, so React 18 consumers work too). Event props keep their DOM types.
- Data attributes carry mode **names**, not ids, so the types are readable. That requires names unique per collection (case-insensitive); the validator and Diagnostics enforce it. The stylesheet selectors change from ids to names in the same step.
- Every literal written into TSX (labels, placeholder text, Custom schema strings) goes through one escaping printer (`JSON.stringify` for strings, identifier check for names), never string concatenation of user text.

### 2.2 Screen TSX

A frame becomes `Frame<Name>.tsx`: plain nodes are elements whose `style` objects come from `node-style.js` (the code `dom-tree.js` already has, moved, not rewritten); template instances are component usages with their props and modes (`<Button variant="solid" size="lg" label="Next" />`). Interactions are attributes the bridge reads (`data-node-id`, `onClick={() => midas.trigger('n42', 'onClick')}`); no flow logic lives in the TSX.

### 2.3 Play runtime (requirement 2)

- Host: the Play overlay mounts `<iframe sandbox="allow-scripts">` (no `allow-same-origin`) with a `srcdoc` boot page. The parent sends `{ files, entry, fonts, css }`; the iframe answers `ready`, `trigger { nodeId, event }`, `error { file, line, message }`.
- Compile: Sucrase (`transforms: ['typescript', 'jsx']`, automatic runtime) in the iframe. No type check in this path. Sucrase over esbuild-wasm: Sucrase is a plain JS file that compiles synchronously, while esbuild-wasm is a download of roughly ten megabytes plus a worker; esbuild stays the server bundler. Sizes here are from memory and are measured in step 6 before the choice is final. Compiled modules are cached by the hash of their source, so only edited components recompile.
- Modules: a small loader resolves `react`, `react-dom/client`, `./runtime` and the generated files from the message; React comes from the studio bundle (vendored into the boot page), never a CDN.
- The player stays in the parent: a trigger goes to `respond()`, and the parent sends `show { frame, transition }` back. Transitions and overlays render inside the iframe from the same descriptors they use today.
- Errors: a compile or render error shows in the Play chrome with the file and line, and the error boundary keeps the previous frame on screen.

### 2.4 Component behaviour replaces Play patches (requirement 3)

| Play-only id | Today | In the generated component |
|---|---|---|
| hover, active, focus-ring, focus-halo | CSS states in the stylesheet | Unchanged (already the component's CSS). |
| wave | `waveDown` in codegen, `showWave` in Play | The codegen version only; Play's copy is deleted. |
| spin | `SPIN_ANIMATION` inline style set by `dom-tree.js` | A `@keyframes` rule plus the part's `animation` in `Button.css`; the canvas draws the spinner at rest. |
| loading-click | `data-blocked` and `isDisabledTarget` in Play | `blocked` already short-circuits `onClick` in the TSX; the Play check is deleted. |
| typing, caret | live input patches in `play.js` | `useControllable(value, defaultValue, onChange)`: controlled when `value` is passed, internal state otherwise. |
| clear click, clear visibility | `hidden` toggled by Play | `onClear` handler sets the value to `''`; visibility is `allowClear && value !== ''` in render. |
| live count | Play rewrites the count text | `{value.length}{maxLength != null ? ` / ${maxLength}` : ''}` in render, from state. |
| hover cursor | inline `cursor` from `def.cursor` | The slot's CSS rule. |
| validation | not built | Section 6. |

Each schema `playOnly` entry gets a `behaviour` field naming one of the engine's generic behaviours (`controllable`, `clearable`, `counter`, `blockWhile`, `spin`, `wave`, `cssState`). The validator refuses an entry with none. The behaviours live once in `runtime.tsx`; templates select them as data.

## 3. Migration (strangler; every step keeps the unit suites and `test:browser` green)

| Step | Change | Gate | Size |
|---|---|---|---|
| 1 | Move node → CSS mapping out of `dom-tree.js` into `node-style.js`. Pure refactor. | All suites unchanged. | S (0.5 d) |
| 2 | Component emitter writes `.tsx`: `Props` types, `forwardRef`, `className`/`style`/rest. `export-parity` compiles it with esbuild (it strips TS already). New CI test: `tsc --noEmit` over the generated Button and Input. | export-parity, new type-check test. | M (2 d) |
| 3 | Mode names in data attributes and selectors (types need names). Play's `dom-tree.js` writes names too. Validator and Diagnostics: unique mode names per collection. | strict-parity, codegen tests. | M (1 d) |
| 4 | Component behaviour (section 2.4) in the TSX and CSS: spin keyframes, `useControllable`, clear, counter. Play still uses `dom-tree.js`. | export-parity extended to typing, clear and count in the exported component. | M (2–3 d) |
| 5 | Screen emitter: frame → TSX from `node-style.js` and component usages. Browser test renders it with esbuild and compares every box with today's Play (`dom-tree.js`) at 0.5 px. | New screen-parity gate. | L (4–5 d) |
| 6 | Iframe runtime (Sucrase, loader, bridge, error display), behind `play.engine = 'tsx'`. Browser harness learns `frameLocator`. Run the whole browser suite on both engines. | All browser tests on both engines. | L (4–6 d) |
| 7 | Switch Play to TSX. Delete `renderTemplate`, the descriptor mount, Play's live patches, `showWave`, `isDisabledTarget`'s blocked branch. export-parity becomes a smoke test. | All suites; canvas vs Play parity unchanged. | M (2 d) |
| 8 | Custom template (section 5). | Unit: document registry, load rules, generator on a Custom schema. Browser: paste schema → panel → Play. | L (4–5 d) |
| 9 | Validation (section 6). | Unit: rule runner; browser: change/blur/submit. | M–L (3–4 d) |

Steps 1–4 have value on their own (typed export, real component behaviour) even if 5–7 slip.

## 4. Risks

- **Load time.** React, ReactDOM and Sucrase load once per Play open (tens of kB gzipped each; to be measured); compile is per changed file (hash cache). Target: first frame under 300 ms on the testing file, asserted in the step 6 browser test.
- **Sandboxing.** Generated code is evaluated, and Custom schemas are user data. The iframe has no same-origin, no network beyond the boot page, and a CSP (`default-src 'none'; script-src 'unsafe-eval' blob:`). Schemas never contain code: only data the emitter turns into code through the escaping printer.
- **Canvas keeps its own draw calls.** Play == export, but canvas vs Play can still drift; strict-parity, dark-corners and parts stay as gates.
- **Iframe side effects.** Scaling modes become a transform on the iframe; fonts load inside it (the parent passes the font faces); keyboard focus and Ctrl+\ need forwarding; Playwright tests need `frameLocator`.
- **Two emitters during migration.** Until step 7, `dom-tree.js` and the TSX can disagree; export-parity and screen-parity catch it.
- **Library package overlap.** The old emitter and its per-component kits must be reconciled (see the audit); otherwise a published library ships two behaviours.

## 5. Custom template

1. Behavior panel on a master: the template picker lists the built-in templates and **Custom**.
2. Choosing Custom shows a JSON schema box (the same `cmp-prop2` field rows; a monospace `cmp-input` textarea). **Apply** parses it and runs `validateTemplateSchema` plus Custom rules: the id is `custom-<slug>` and does not clash with a built-in or another Custom id; only engine-known kinds, node properties and token kinds; every token with a role names a role in `roles.json` or declares `tokenRoles`. Errors list under the box with the path (`props.size.modes[2]`); nothing is stored until it is valid.
3. A valid schema is stored in the document under the one Behavior key: `behavior: { version, templates: { [id]: schema } }`. It is document data: saved, undone, copied with the file, and published with a library version. It never enters the code registry.
4. The document registry (`templatesOf(doc)`) returns built-in plus document templates; every engine call site reads through it. Load rules: a document whose `behavior.templates` shape or version mismatches, or holds a schema that fails validation, fails to open with the explicit error (no repair, no partial load).
5. Bind runs the existing pipeline unchanged: `createBinding` → collections named "<Template> <Name>" (Variant, Size, …) in one transaction → Auto Fix aliases component variables by role → `applyTemplateNodes` adds the parts and slots → `planBindTokens` binds node properties. Instances get the Behavior panel from the schema (props, slots, switches) through `panel.js`, as built-in templates do.
6. Editing an applied Custom schema re-validates, then re-runs the generator idempotently: it adds what is missing and removes nothing; extra layers or variables show as Diagnostics. Removing a prop that instances hold values for is refused with the instance count (no silent data loss).
7. Export and Play: the component emitter treats a Custom schema exactly like Button; there is no Custom-specific code.

## 6. Validation plan

Rules are schema data; one generic runner in `runtime.tsx` applies them.

- **Control constraints** (Input): `minLength`, `maxLength` (exist), `type: 'text' | 'email' | 'number' | 'url' | 'password'`, `pattern`. They are literal props, so the canvas shows the configured values in the panel and the input attributes carry them in the TSX.
- **FormItem** (a new built-in template, schema only): a label, the control slot (any instance), a help text part, a required mark part. Props: `name`, `rules`, `validateTrigger: ('onChange' | 'onBlur' | 'onSubmit')[]`, `validateStatus` (a variable prop on a `Status` collection: `default | error | warning | success | validating`), `help`.
  - `rules`: `[{ required: true, message }, { min, max, message }, { pattern, message }, { type: 'email', message }]`, stored as data on the instance and edited as rows in the panel.
- **Runtime**: FormItem holds `{ status, message }` state; on each trigger it runs the rules on the control's value and provides the result through a context (as antd's `FormItemInputContext`). The control reads the context: its `status` data attribute picks the Status mode (Input already has a Status collection), and the help part shows the message.
- **Canvas**: static only. `validateStatus` and `help` on the instance show an error or warning look on the canvas; no rule runs there.
- **Prototype**: an `onSubmit` trigger (a Button inside a frame with FormItems) validates every FormItem in that frame; navigation from that trigger runs only when all pass. A new `submit-invalid` destination is out of scope until asked.
- **Tests**: unit tests for the rule runner and trigger matrix; one browser test for change, blur and submit on the testing file.
