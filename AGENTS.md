# Agent instructions

## Principles

- Canvas is the source of truth; Play derives from the node tree; antd is a structure reference only (variants, props, states, sizes, slots, token names); never replicate antd pixel/DOM.
- Values come from variables (Primitives → Semantic), never copied from elsewhere.
- Hug/fill/fixed sizing is owned by the node; the engine writes it only to fix an axis bound to a variable (`fixBoundAxes`, read through `sizingOf`/`ownSizingOf`: a bound width or height is fixed in every mode, never hug or fill).
- The engine is generic and schema-driven; no per-component code in the engine.
- Strict: no legacy, no migration shims; old files are regenerated.
- Source of truth for decisions is `docs/behavior-spec.md`; it wins over the roadmap.
- Plan: `docs/roadmap.md`.

## Permanent rules

- Not a released product. No backward compatibility, migrations, legacy fallbacks, deprecated aliases, compatibility shims, or "old behavior" branches.
- Delete any function, type, field, or file that does not fit the current plan. No dead code, commented-out code, or unused exports.
- All Behavior data lives under one `behavior` key with a `version` field. Files without `behavior` data open normally, even if they contain components. Files whose `behavior` version/shape mismatches must fail to open with a clear explicit error. Never repair or partially load.
- Templates are data; engine logic stays out of templates.
- Source of truth for decisions is `docs/behavior-spec.md`. Read it before each task. Update its Status section when a stage finishes.
- Workflow per stage: plan briefly, confirm seams, implement with `tdd`, run `code-review`, fix findings, then `handoff`.
- Do only what is asked; no extra features.

## Decisions

- Fase 0 triage (2026-10-31): Button stroke/label/icon-slot/disabled code is done and tested; triage changed no product code.
- Baseline green: builder-core 842 tests, studio 53 tests, 0 failing. Button root owns a stroke bound to `border`; bound strokes never emit inline border props (`outline-color` is the focus ring only); testing.midas regenerates via `scripts/make-testing-file.js`.
- Input parity: the wrapper owns all box visuals and interaction states (`focusTarget: "wrapper"`, `:has()` selectors in codegen); the inner control owns text only. No per-component code in the engine.
- Icon choices are remembered per managed slot (generic engine rule: placement carry, retained icon props); the instance Preview panel shows the state select only, no resolved-token list.
- Fixtures are generator-built only: every template master and instance in scripts/fixtures and testing.midas comes from scripts/generated-part.mjs (applyTemplateToFrame, instanceOf). No script writes a template part (a layer marked `part` or `slot`) by hand; the Behavior fixture keeps one deliberate error (the legacy master's missing hover value) that its test asserts.
- Icon slot: an icon slot that starts to show with no icon chosen (its switch turned on, or Input's kind changed to Icon; `newlyShownIconDefaults`) takes the library's first `Icon/<name>` component; one already shown, or holding an icon, is left alone. With no library component it keeps its box, draws nothing, and the Diagnostics show `icon-slot-empty`.
- Input side slots follow antd: the prefix and the suffix are the only side slots. Each has a switch (`hasPrefix`, `hasSuffix`), a Text|Icon kind (`prefixKind`, `suffixKind`, a segmented enum) and its content: text (hugs) or a swappable managed icon (`prefixIcon`, `suffixIcon`, sized by `iconSize`, coloured by `fg`). Text, icon and kind are remembered per side. Input has no `hasIcon`, `iconPlacement`, `icon` or `iconEnd`; Button keeps `hasIcon` with start or end only, never both. Allow Clear is an icon slot and Show Count a text part, between the value and the suffix. A prop's `visibleIf` may be an `{ all: [...] }`, and an enum may set `control: 'segmented'`.
- Diagnostics `part-missing`: a master lacks a layer its template requires (a non-optional anatomy slot, an affix text slot, or a canvas part; a managed icon slot is an instance layer and never required). Auto Fix runs the generator (applyTemplateNodes), adds only the missing layers, removes nothing, and runs in its own undo step.
- Base collections generate from the bundled snapshot (`base-snapshot.json`, built by `scripts/build-base-snapshot.js`), no file picker; base tokens change in Generate base (`buildBasePlan`, `roles.json`, `antd-sizes.json`), then the snapshot is rebuilt. The token JSON is expected at `packages/builder-core/src/base-tokens/source/token.json` (or as the script's argument) and the antd source at `D:/antd-ref` (or `ANTD_REF`); the script refuses without both. Only Primitives, Semantic and Typography exist; no Icons or Size.
- Collections are always "<Template> <Name>" (Button Variant, Input Status), never order-dependent, no groups, no group prefix in variable names. A template never writes a default literal: a missing role fails. Auto Fix aliases component variables by schema role, never literals, idempotent.
- Provenance: a component cell aliases Semantic (directly or through its own template's cells). Fixtures build every literal as a Primitive plus a Semantic alias (`scripts/literal-bank.mjs`).
- Gap ladder (`gapXXS`…`gapXL`) replaces margin. Button `gap` aliases `gapXS` (antd `iconGap` = `marginXS`); Input prefix gap is `gapXXS` (antd `inputAffixPadding` = `paddingXXS`).
- Input has no wave in antd (`components/input` imports none); Input uses the focus halo only.
- Colour literals are hex with alpha (`#rrggbbaa`); the studio reads no `rgba(...)` text. The token importer normalises them (`colorLiteral`), so a rebuilt snapshot stays hex.
- Variant border style (`styles`, e.g. dashed) is applied on a Variant mode change and on instantiate, never on sync, so a Stroke Dash/Dots set by hand stays. A user stroke style (Solid, Dash, Dots) is the node's own: Play and the export draw it, and the Variant only sets the default on those two events.
- Auto layout alignment has nine positions and the node owns them: Play and the export read the master's `primaryAlign`/`counterAlign` (an instance's own fields win in Play) through `layout.js`; a template's `rootAlign` only seeds a new master.
- Managed slot order: a slot after the label goes before the first layer the anatomy ranks later (the Input's clear before its suffix), else last; one helper, `indexAmongLaterSlots`, serves the editor's plan and the generator. Play and the export follow the schema order, so the canvas must too.
- Icon-like parts share one definition (`ICON_TOKENS` in icon-slots.js): the Button's start and end icons and its spinner follow `iconSize` and `fg` (`fg-disabled` while disabled) and are bound by one function (`iconSlotBindings`, layers listed by `iconBoundKeysOf`); an arc part's stroke is the CSS `color`. Prefix and suffix icons follow the same tokens. A managed icon slot is drawn with its colour from its class (export and Play, never inline, so a hover rule can win).
- Input clear icon: `clearIconSize` = icon size minus 2 per Size mode, derived in the base data (antd-sizes.json `from`/`offset`, validated by the importer, never a number in the template); colour is the `placeholder` token, hover is `clear-hover` (Semantic colorTextSecondary; play-only "hover has no static canvas visual"), cursor pointer. Value wins over the placeholder: the control's `hidePlaceholderWhenFilled` hides the placeholder part while the value is not empty (canvas partWrites, Play, export); `hideWhenEmpty` hides the value layer while it is empty.
- Content slots (a frame instances fill: a component property of type `slot`, `propBind.slot`) are not icon slots (managed layers of a template); never merge them. Their pure decisions live in builder-core (`content-slots.js`, `slot-rules.js`, `slot-property.js`, `slot-diagnostics.js`), not in midas.js. The picker blocks `max` and `onlyPreferred`; every other path only warns: `diagnoseSlots` in the Diagnostics, and a notice from `transaction()` for what an edit newly broke. A template declares content slots as data in `slots` (`SlotDef`, validated by `slotProblems`): the slot `id` is its prop name in the generated code and `accepts` names template ids of the registry and is stored on the slot property with `onlyAccepts`; a candidate's template is its master's `behavior.templateId` (`templateIdsOf`), never an id or a name; `preferred` stays component ids and works only while `onlyAccepts` is off: with it on, the template contract binds and preferred does not widen it. An empty slot is shown only with `showEmpty` (the instance's slot layer is hidden otherwise: `slotVisible`, written where a component property drives visibility); a component put into a slot fills the counter axis once (`slotFillPatch`, always for a horizontal slot); Reset gives a slot back (`releaseSlot`).
- Variables window: a file starts with no collection. Create variable makes "Collection 1" + "Mode 1" in the same transaction; nothing else auto-creates one. No Enum variable type.
- Play starts at the top-level frame that holds the selection (a child starts its frame), overriding the flow start marker; with nothing selected, the flow start, then the first frame.
- Size numbers (except line height) follow antd-ref, aliased through Semantic to Primitives steps; colors and the rest come from the token JSON. Intentional exception to "values come from variables".
- Typography is a composite variable type (colour excluded): Primitives hold raw styles, Semantic styles alias them whole per mode, component typography aliases Semantic per Size mode; text parts declare `typography: <role>`; lineHeight is px only.
- Typography editor: the Variables cell opens a floating window (one mode, typed pickers per member, whole-style alias, weight names per family, ratio lineHeight refused). Design panel: attach and detach act on every selected text layer in one undo step each; attached fields are read-only; attach links the style collection to the layer's modes.
- The base `.button` rule keeps its 2px transparent outline (see the focus-outline test); never remove the outline from the base rule.
- Visibility contract: every template declares `parts` (canvas nodes, each with `shownWhen`; `canvas: false` needs a reason) and `playOnly` (each with a reason); static parts are nodes. Browser check: `npm run test:browser --workspace @midas/studio`, then look at `.artifacts/` screenshots before reporting. Open drift: the Play host border shifts children by 1px (canvas stroke is inside the padding); hug text boxes carry 1px slack (hugText), so a label is 1px wider than Play; an empty Input keeps the value's 8px gap, and its placeholder has no Play element.
- Parity gate (browser, `npm run test:browser --workspace @midas/studio`): canvas and Play are measured at 1:1 for every Size and key state. The gate is geometry: every part's box within 0.5px, the root width within 0.1px, and the outline's width, height and centre within 0.5px (`edgeCheck`). The export (JSX and CSS, compiled and rendered) must put its input, clear and counter within 0.5px of Play's boxes (`export-parity.browser.test.mjs`).
- Pixel diff is informational: the share of pixels that differ on a 5x5 blurred luminance is written per pair under a loose 8% ceiling. The residual is the rasterizer's, not a parity claim: DOM text is drawn with LCD subpixel anti-aliasing and canvas text in grey-scale, and rounded corners anti-alias differently. Do not change product text rendering to chase it.
- Pair images: `npm run test:browser --workspace @midas/studio` writes `.artifacts/pair-<template>-<size>-<state>-{canvas,play,diff}.png`, `.artifacts/strict-parity.json` (per pair: the rows, the diff counts and the outline edges) and `.artifacts/export-parity.json` (per state: the exported and Play boxes). `.artifacts/` is not committed; regenerate by running the suite.
- Setup: after pulling a migration (apps/server/drizzle), run `npm run db:migrate`. The server refuses to start while migrations are pending and names them; a database that lacks `0008_library_docs` made `GET /api/libraries` fail with `column libraries.docs_public does not exist` (500).
- Dev needs `infra:up` with Docker Desktop running before `dev:server`, else the seed fails with ECONNREFUSED on postgres (5433); on Windows run `dev:server` and `dev:studio` separately.

## Code map

- Button template: `packages/builder-core/src/templates/button.js`. Engine: `packages/builder-core/src/behavior-engine/` (`codegen.js`, `preview.js`, `anatomy.js`, `icon-slot.js`, `display.js`).
- Play DOM: `packages/builder-core/src/prototype/dom-tree.js` (`renderButton` plus codegen stylesheet). Panel: `apps/studio/src/engine/behaviorPanel.js`.
- Button variable fixture: `scripts/button-model.mjs` (gap sm=6, lg=8 in fixtures; the production gap is `gapXS`, see Decisions).

## Known issues

- The Behavior panel's Text|Icon segmented control and the Input prefix/suffix rows are covered by unit tests only; they have not been looked at in a browser. `affix.browser.test.mjs` was edited to the new rows and not run.

- Strict parity (browser) fails 3 of ~100 Input xs pairs, on HEAD and since: `xs allowClear` and `xs showCount` "outline not found on both shots" and `xs suffix` outline 0.70px. The part boxes match within 0.01px, so it is the outline edge check on a 16px control, not layout. Open.
- The browser harness reuses any server already listening on 4000/5174, so a stale `test:browser` run (or its servers) shares the database with the next run and makes it flaky (timeouts, a "changed somewhere else" dialog). Stop stale runs before a baseline.

- Fase 0 browser verification (canvas, Play, codegen in a real React project) not done — no browser automation.
- The roadmap names `strokeStrategyOf`/`rootLayoutOf`/`labelLayoutOf` and a `both` placement: none exist in code; if wanted, they are new features, not fixes.
- Wave colour is the variant's strong colour (solid bg, outlined/dashed border, filled and text fg); the spinner is antd's quarter arc (LoadingOutlined geometry, 1px, sweep 25%), and a part with `spin` turns in Play only (the codegen export draws the arc at rest, sized by its display `size` token).
- Export corners: the export keeps the fill on the root with a `::before` stroke overlay, so a consumer `background` override on `.X` still applies; Play puts the fill in the overlay (80942bd). Measured on dark and image backgrounds: no visible ring, one 0.51px speck at Button Large. Revisit only if a visible ring is reported on a published component. Phase 3: exported components must accept `className`, `style`, `ref` and rest props before a library is published.
- Outline/ring/wave: `outline-color` is always 0% at rest (alias to Semantic `outlineTransparent`, itself a 0% Primitive derive); `outline-color-active` is the interaction colour. Ring (`:focus-visible`) and wave (click, `data-wave-on`) are DOM-only behaviors configured by schema `interaction`; never drawn on canvas, no panel controls.

## Antrean

- Fase 1 batch 1 done: Input template exists, `control` kind is generic (real `<input>` in Play/codegen). Single-line only.
- A template root that maps `height` binds the Size `height` variable to h and is fixed vertically (bind-tokens `height: ['h']`, template-master `rootSizingV`).
- Button paddingY is 0 in every size: antd forces `buttonPaddingVertical = 0` (`button/style/token.ts`, `index.ts`); Input paddingY (4 md, 7 lg) comes from `paddingBlock`. Template-qualified tokens are correct. `Input Size` paddingY xl (9) is derived. The token JSON is not in the repo, so `base-snapshot.json` cannot be rebuilt here.

## Maintenance

- Before finishing any change, if it introduced or confirmed a rule, a file location, or a known issue, update this file with 1 to 3 lines. Replace outdated lines instead of appending. Do not log the bug itself.

## UI conventions

- Reuse the shared panel primitives (the classes in `apps/studio/src/styles.css`: `inspector-section`, `section-heading`, `cmp-props` / `cmp-prop2` / `cmp-ctl`, `cmp-input`, `vsw`, `empty-state`, `small-label`, `badge`). Do not write one-off styles for a panel.
- Spacing, sizes and typography come from the shared classes and tokens in `styles.css`. Do not add literal values to a panel's markup.
- No browser-default list styling. Do not use `<ul>` or `<li>` in a panel; use label rows.
- One title per panel. The tab names the panel; section headers use the `section-heading` style.
- Every prop is a label beside its control (`cmp-prop2`), the same as the Design panel's instance props.
- Any UI change is verified visually: take a screenshot of the changed state next to the Design panel for the same selection before reporting it done.

## Agent skills

### Issue tracker

GitHub Issues in `alkhamil/midas`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
