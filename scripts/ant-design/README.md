# Ant Design design system (.midas)

Builds `Ant Design.midas`: the Ant Design components as a Midas design system, made the way the WDS file is made.

```bash
node scripts/ant-design/build.mjs            # writes scripts/ant-design/Ant Design.midas
node --test scripts/ant-design/build.test.mjs
```

Import it from Home → Import file.

## Structure (same layers as the WDS token file)

| Layer | Collection | Modes |
|---|---|---|
| Primitives | `Primitives` | Base (Ant palettes, spacing, radius, font sizes …) |
| Semantic | `Semantic` | Light, Dark (`bg/…`, `text/…`, `border/…`, `ring/…`, `elevation/…`) |
| Size | `Size` | small, middle, large (`button/height`, `input/padding-x` …) |
| Component look | `Button type`, `Input variant`, `Tag styles`, `Alert type` … | the looks (primary, dashed, outlined, success …) |
| Component states | `Button states`, `Input states`, `Checkbox states` … | default, hover, pressed, disabled, focused … |

A component's layers bind to `<Component> states` (colours) and `Size` (metrics); each `<Component> states` variable aliases
the matching `<Component> type` variable, which aliases `Semantic`. An instance picks the modes (look, state, size, theme),
and Preview switches the state by itself (hover, press, focus), because the collections are named "… states".

Composite components (Tabs, Menu, Table, Calendar …) reuse the collections of their item component (`Tabs.Tab`,
`Menu.Item`, `Table.Row`, `Calendar.Day` …) and pin each item to a state with its own variable mode.

## Pages

Cover · Overview (cards open each component's documentation in Preview) · Foundations (palettes, Semantic Light / Dark)
· one page per category with each component set and its documentation frame (looks × states, variants, sizes, dark theme,
React props).

## Files

`lib.mjs` variable store, spec → nodes (bind, auto layout) · `system.mjs` foundations · `define.mjs` `defineComponent`
(collections, set, instances) · `components*.mjs` the components · `build.mjs` pages · `ant-props.json` React props of every
component (shown in the documentation frames).

Not drawn (no visual in the library): Affix, App, ConfigProvider, BorderBeam.
