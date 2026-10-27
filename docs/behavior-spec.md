# Behavior Engine Spec

Source of truth for the Behavior engine. Read this before each task. Update the Status section when a stage finishes.

## Goal

Behavior tab binds a canvas component to a built-in template (Ant Design-structured React component contract). Props come from the template schema, so preview and code generation are deterministic.

## Decisions

- Templates are pure data schemas (anatomy, props, tokens, states, events). Engine logic never lives inside a template. Values are not tied to Ant Design; structure is.
- Binding: component -> templateId. Each variable-prop (variant, size) -> one variable collection. Auto-match by name (case-insensitive). No match = empty, user picks from a dropdown manually. Modes of the bound collection are the prop's values as-is. Custom modes are allowed.
- Dimensions (props) are locked by the schema. Users cannot add props (e.g. no `shape`). Only values/modes of schema-defined variable dimensions are open.
- A collection on the canvas not bound to any dimension of the component: warn "unused collection"; excluded from preview and code generation.
- Size mode resolves to tokens: fontSize, lineHeight, paddingX, paddingY, gap, radius, iconSize. Variant mode resolves to bg, fg, border (plus per-state).
- Master vs instance: master holds only binding (template + collections). Instances hold prop values (hasIcon, iconPlacement, icon, loading, disabled, variant mode, size mode). Master never holds icon choice or placement.
- Managed slots: anatomy slots marked `managed` (iconStart, iconEnd) are inserted/removed by Behavior per instance based on hasIcon/iconPlacement. Icon spacing uses the size `gap` token. Managed layers are marked "managed by Behavior".
- Icon source: Midas built-in library, or SVG components in the current file (raw SVG is not selectable). Single-color icons normalize to `currentColor`; multi-color icons are flagged "not themeable"; user can toggle themeable manually.
- Preview renders the real React template component with props and CSS variable tokens from binding. Generated code uses the same components.
- Behavior defaults live in the template (e.g. Input `validateOn` default `blur`). Loading/disabled block onClick.
- Prototype (frame-to-frame interactions, overlays, scroll/sticky) is a separate tab, out of scope for now. Behavior events with `exposeAsTrigger: true` become Prototype triggers later.
- Template rollout: Button only until the full pipeline works end to end. Next: Input, Checkbox, Select, Form, Modal, Tabs.

## Button schema

- anatomy: iconStart (optional, managed), label (text, required), iconEnd (optional, managed)
- props:
  - variant (variable, collection "Variant")
  - size (variable, collection "Size")
  - label (string, "Button")
  - hasIcon (boolean, false)
  - iconPlacement (start|end, "start", visibleIf hasIcon)
  - icon (iconComponent, visibleIf hasIcon)
  - loading (boolean, false)
  - disabled (boolean, false)
  - fullWidth (boolean, false)
  - No `danger` prop; it is a variant mode.
- tokens:
  - fromSize: fontSize, lineHeight, paddingX, paddingY, gap, radius, iconSize
  - fromVariant: bg, fg, border
- states: default, hover, active, focus, disabled, loading
- events:
  - onClick (exposeAsTrigger true)
  - onHover (exposeAsTrigger true)
  - onFocus (exposeAsTrigger false)
  - onBlur (exposeAsTrigger false)

## Stages

Execute in the order listed. The numbers are stage IDs, not the execution order.

1. Schema + registry
2. Binding model
3. Instance props store
5. Panel renderer
4. Variable -> token resolver
6. Anatomy sync
7. Preview renderer
8. Code generator
9. Diagnostics

## Status

- [x] Stage 1: Schema + registry
- [x] Stage 2: Binding model
- [x] Stage 3: Instance props store
- [ ] Stage 5: Panel renderer
- [ ] Stage 4: Variable -> token resolver
- [ ] Stage 6: Anatomy sync
- [ ] Stage 7: Preview renderer
- [ ] Stage 8: Code generator
- [ ] Stage 9: Diagnostics
