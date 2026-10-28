# Agent instructions

## Permanent rules

- Not a released product. No backward compatibility, migrations, legacy fallbacks, deprecated aliases, compatibility shims, or "old behavior" branches.
- Delete any function, type, field, or file that does not fit the current plan. No dead code, commented-out code, or unused exports.
- All Behavior data lives under one `behavior` key with a `version` field. Files without `behavior` data open normally, even if they contain components. Files whose `behavior` version/shape mismatches must fail to open with a clear explicit error. Never repair or partially load.
- Templates are data; engine logic stays out of templates.
- Source of truth for decisions is `docs/behavior-spec.md`. Read it before each task. Update its Status section when a stage finishes.
- Workflow per stage: plan briefly, confirm seams, implement with `tdd`, run `code-review`, fix findings, then `handoff`.
- Do only what is asked; no extra features.

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
