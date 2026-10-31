# Agent instructions

## Principles

- Values come from variables (Primitives → Semantic), never copied from elsewhere.
- Hug/fill/fixed sizing is owned by the node; the engine never writes it.
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
- Baseline green: builder-core 754 tests, studio 46 tests, 0 failing. Button root owns a stroke bound to `border`; bound strokes never emit inline border props (`outline-color` is the focus ring only); testing.midas regenerates via `scripts/make-testing-file.js`.
- The base `.button` rule keeps its 2px transparent outline (see the focus-outline test); never remove the outline from the base rule.

## Code map

- Button template: `packages/builder-core/src/templates/button.js`. Engine: `packages/builder-core/src/behavior-engine/` (`codegen.js`, `preview.js`, `anatomy.js`, `icon-slot.js`, `display.js`).
- Play DOM: `packages/builder-core/src/prototype/dom-tree.js` (`renderButton` plus codegen stylesheet). Panel: `apps/studio/src/engine/behaviorPanel.js`.
- Button variable fixture: `scripts/button-model.mjs` (gap sm=6, lg=8 — not 16; see Antrean).

## Known issues

- Fase 0 browser verification (canvas, Play, codegen in a real React project) not done — no browser automation.
- The roadmap names `strokeStrategyOf`/`rootLayoutOf`/`labelLayoutOf` and a `both` placement: none exist in code; if wanted, they are new features, not fixes.
- Play shows a black ring on `.button` in default state. Suspect `--button-outline-color` resolving to a non-transparent value (currentColor/black) with no state active. Do not remove the outline from the base rule.

## Antrean

- Fase 1 batch 1 (Input plus `control` kind) after the Fase 0 browser exit.
- Open: is gap default 16 a new token or a fixture change (current: sm=6, lg=8)?

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
