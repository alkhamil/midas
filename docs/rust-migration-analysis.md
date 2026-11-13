# Rust migration analysis: FigCraft as a reference for the Midas core

Date: 2026-11-13. Read-only study of `D:\FigCraft\figcraft-main` (workspace version 0.18.1) against Midas at `feat/fahmi` (`1266957`). No Midas code was changed.

How to read this: every FigCraft claim cites a file and a function I opened. Things I did not verify are listed in [Not verified](#not-verified). Line counts come from `wc -l` over `*.rs` / `*.js` and include tests.

## Summary

- **License:** FigCraft code is `MIT OR Apache-2.0`. It may be copied and adapted into Midas with attribution. Brand assets are excluded.
- **FigCraft is not a GPU renderer.** Its canvas is drawn on the CPU by tiny-skia; WebGPU only presents the egui UI and the finished image. Midas already draws shapes on WebGPU. Moving to Rust buys one shared geometry and paint implementation, not canvas speed.
- **The best thing to take is the stroke pipeline.** One function (`stroke_area`) turns any stroke into a filled outline path, and the canvas, SVG, PDF, shadows and booleans all use it. Midas has four separate stroke implementations (canvas clip trick, shader band, SVG clip/mask, CSS border in Play).
- **Two requested paint types do not exist in FigCraft:** there is no Video paint and no Noise paint. Noise is a layer effect there. Midas has Video; neither has Noise as a paint.
- **Midas is JavaScript, not TypeScript** (`.js` with JSDoc and one `index.d.ts`). The plan below says "JS" where the request said "TS".
- **Recommendation:** do Phase 1 (Paint and Stroke model plus stroke geometry) as a real test of the bridge, then decide on the rest. Phases 3 and 5 are large and high risk, and FigCraft gives no evidence that they pay off for a DOM-based Play.

## 1. License

- `Cargo.toml` `[workspace.package]`: `license = "MIT OR Apache-2.0"`. `LICENSE-MIT` and `LICENSE-APACHE` are at the repo root. `NOTICE`: "Copyright (c) 2026 ArtCraft Team and the FigCraft contributors".
- **Code may be copied or adapted into Midas.** Choose either licence:
  - MIT: keep the copyright line and the MIT text with the copied code.
  - Apache-2.0: keep the licence text and the `NOTICE` attribution, and mark changed files.
- **Not covered:** the ArtCraft name and logos in `docs/brand/` (`docs/brand/LICENSE-brand.txt`, trademarks, "not open source"). Fonts are not in the repo (`ATTRIBUTION.md`).
- Dependencies keep their own licences (`NOTICE`). The ones Phase 1 would use are `kurbo` and `linesweeper`; I did not check each crate's licence file.
- FigCraft's own "clean room" rule (`AGENTS.md`) binds its contributors, not users of its code.
- This is a reading of the licence files, not legal advice. Midas has no licence obligations today that I checked against.

## 2. Architecture map

### Crates

Layering is enforced by `cargo xtask layers` (`docs/architecture.md`): a crate depends only on lower layers, and nothing below L6 depends on egui.

| Layer | Crate | Lines | Responsibility |
|---|---|---|---|
| L0 | `geom` | 1.7k | Affine transforms, shape path builders (rounded and smoothed rects, polygons, stars, arcs) on `kurbo` |
| L0 | `color` | 2.4k | `Color`, `Paint`, `PaintKind`, gradients, image and pattern paints, `BlendMode`, colour profiles |
| L1 | `doc` | 15.8k | Document: pages, node tree, `StrokeProps`, effects, auto layout props, components, styles, variables, prototype data |
| L2 | `layout` | 3.5k | Auto layout, constraints, layout grids |
| L2 | `text` | 9.3k | Font database, shaping (harfrust), bidi, line layout, glyph outlines (skrifa) |
| L2 | `pathops` | 3.2k | Booleans (`linesweeper`), stroke outlines with alignment, dashes, width profiles, brushes, arrowheads |
| L2 | `collab`, `plugin` | 10.2k, 2.9k | Collaboration core, WASM plugin sandbox |
| L3 | `render` | 13.8k | Scene to pixels on tiny-skia (CPU), retained rendering, effects |
| L3 | `format` | 46.4k | `.figcraft` file, `.fig` import and export, REST JSON import |
| L4 | `svg`, `pdf`, `vectordrawable` | 6.6k, 2.8k, 2.4k | Exporters (SVG also imports) |
| L5 | `engine` | 128.4k | Sessions, undo, command registry, tools, components sync, prototype runtime, code generation |
| L6 | `ui-egui`, `mcp`, `collab-net` | 93.0k, 4.7k, 9.7k | egui frontend, MCP server, networking |
| apps | `figcraft`, `figcraft-cli`, `figcraft-web`, `figcraft-server` | 4.2k, 3.0k, 1.6k, 9.1k | Desktop, CLI, browser build, collaboration server |

Dependency graph for the parts that matter here (from each `Cargo.toml`):

```
geom, color
  └─ doc
       ├─ layout
       ├─ text
       └─ pathops
            └─ render (also: text, format, color, geom)
                 ├─ svg
                 ├─ pdf
                 └─ vectordrawable
                      └─ engine (everything above)
                           └─ ui-egui → apps
```

### Render backend

- **CPU.** `crates/render` draws with `tiny-skia` (`draw.rs` `draw_content`, `fill_with`). `docs/architecture.md`: "The CPU renderer is the single source of pixels for the canvas, exports and the browser."
- The desktop canvas renders on a worker thread and keeps its last image (`render::Retained`); overlays are drawn by egui (`crates/ui-egui/src/canvas/render_worker.rs`).
- In the browser the render runs on the UI thread, a band at a time, with a coarse preview first (`render_worker.rs` header comment).

### Web build

- `apps/figcraft-web`: the same `FigApp` through eframe's web runner, built by Trunk (`index.html`, `Trunk.toml`). wgpu uses WebGPU with a WebGL2 fallback, but only to present egui.
- Profile `web-release` in the root `Cargo.toml` is size-optimised; its comment records 22.2 MiB after `wasm-opt` for the whole app, against a 24 MiB packaging gate.
- A panic cannot be caught in WASM, so the page stops and unsaved files are kept in local storage (`apps/figcraft-web/src/main.rs` header, `recovery.rs`).

### UI to core

- No JS UI. The egui panels call `FigApp::run(id, params)` (`crates/ui-egui/src/app/commands.rs`) and `set_props` (`panels/right.rs`), which dispatch engine commands with JSON params.
- The browser page can expose `window.figcraft` with `?control` (`apps/figcraft-web/src/api.rs`).

### Commands and undo

- Every behaviour is a `CommandSpec` made with `spec!(id, label, params_doc, history, run)` (`crates/engine/src/cmd.rs`), collected in one `registry()`.
- `Session::execute` (`crates/engine/src/session/exec.rs`): look up the command, snapshot the document, run it under `guard::run`, run checks, then `normalize_edit`. On any error or panic the document, selection and page are restored from the snapshot.
- `derived::normalize` (`crates/engine/src/derived.rs`) re-derives state after each edit: variable bindings, style links, text boxes, instances, auto layout.
- Undo is whole-document snapshots: `History { undo, redo }` of `HistoryEntry { label, doc: Arc<Document>, selection, page }` (`doc_state.rs`), `Session::undo` / `redo` (`session/undo.rs`). Snapshots are cheap because nodes live in a persistent map (`imbl`).

### Data model

- `Node` (`crates/doc/src/node.rs`): `id`, `kind: NodeKind`, `parent`, `children`, `transform`, `width`, `height`, `fills: Vec<Paint>`, `strokes: Vec<Paint>`, `stroke: StrokeProps`, `effects: Vec<Effect>`, `corners`, `layout`, `child_layout`, `bound: BTreeMap<String, VariableId>`, `var_modes`, `overrides`, and more.
- `NodeKind`: `Page`, `Frame`, `Group`, `Section`, `Rectangle`, `Ellipse`, `Polygon`, `Star`, `Line`, `Vector { network }`, `Text`, `BooleanOp`, `Component`, `ComponentSet`, `Instance`, `Slice`.
- `Paint` (`crates/color/src/lib.rs`): `kind: PaintKind` plus `opacity`, `visible`, `blend`, `color_alpha`. `PaintKind` is `Solid`, `Gradient`, `Image`, `Pattern`.
- `Effect` / `EffectKind` (`crates/doc/src/props.rs`): drop shadow, inner shadow, layer blur, background blur, noise, texture, glass.
- Variables (`crates/doc/src/styles.rs`): `VariableType` is `Color`, `Number`, `String`, `Boolean`. `VariableValue` adds `Alias`, `ColorAlpha` and `ColorMix`. Collections have modes; a node picks modes in `var_modes`.

## 3. Stroke deep-dive

### Types

- `StrokeAlign { Inside, Center, Outside }`, default `Inside` (`crates/doc/src/props.rs`).
- `StrokeCap`: `None`, `Round`, `Square`, and five arrowheads (`LineArrow`, `TriangleArrow`, `ReversedTriangle`, `CircleFilled`, `DiamondFilled`). `StrokeJoin`: `Miter`, `Bevel`, `Round`.
- `StrokeProps`: `weight`, `align`, `sides: Option<[f64; 4]>` (top, right, bottom, left), `cap_start`, `cap_end`, `join`, `miter_limit` (default 4), `dashes: Vec<f64>`, `dash_cap`, `width_profile`, `brush`.
- One `StrokeProps` per node is shared by every paint in `Node.strokes`.

### `stroke_area`

`figcraft_render::draw::stroke_area(n, path, closed) -> Arc<BezPath>` (`crates/render/src/draw.rs`) returns the painted stroke as a fill path in local coordinates. It tries three routes in order:

1. **Per-side weights** (`side_strokes`): `pathops::rect_side_strokes` for square corners, `rounded_side_strokes` for rounded ones. The rounded version follows CSS borders: the inner edge is inset by each side's weight with elliptical corners `max(0, R − weight)`.
2. **Ring shortcut:** a solid inside or outside stroke on a rectangle-like node or a full ellipse is two outlines filled even-odd, with no boolean. Inside is `ring(0)` + `ring(w)`; outside is `ring(-w)` + `ring(0)`. The corner radius shrinks or grows with the inset.
3. **General outline** (`cached_stroke_outline` → `pathops::stroke_outline_of`), cached by a hash of the geometry and every stroke property (4096 entries).

The fill rule comes from `stroke_rule(n, closed)`: even-odd for per-side strokes and for solid inside/outside strokes on closed shapes, non-zero otherwise.

### Inside, center, outside

In `pathops::stroke_outline_of` (`crates/pathops/src/lib.rs`):

- `Center`: stroke at the weight.
- `Inside`: stroke at twice the weight, then boolean **intersection** with the shape.
- `Outside`: stroke at twice the weight, then boolean **difference** with the shape.
- The clip uses the shape's own fill rule, so holes of an even-odd vector stay holes.
- **Open paths:** `align` is forced to `Center` when `closed_shape` is false. `doc::geometry::is_closed` is false for a `Line` and for a vector with no regions.
- **Text:** `draw_content` strokes each style's glyph outlines with `stroke_area(n, path, true)`, so inside and outside work on glyphs. Glyphs that are bitmaps have no outline and get no stroke.

### Dashes, joins, caps

- `width::dash_pattern`: drops negative and non-finite entries; an odd-length list is repeated twice; a pattern summing to under 0.01 is solid.
- `width::line_dashes`: an **open** line scales the pattern so a whole number fits and starts half a dash in, so both ends show a half dash. A **closed** line runs the pattern as written.
- Each subpath fits its own pattern (`stroke_center` loops `split_subpaths`).
- A zero-length dash draws as a dot when the cap is round (`stroke_center`).
- `StrokeProps::band_caps`: a dashed stroke with a `dash_cap` uses it on both ends of every dash.
- Too many dashes fall back to a solid stroke (`width::dashes_fit`, `MAX_DASHES`).
- Joins and caps map to kurbo (`kjoin`, `kcap`); the miter limit is clamped to 1–100. The weight is capped at `MAX_STROKE_WIDTH` (1e6).
- Arrowheads are separate filled shapes added on open paths only (`pathops::arrowhead`).
- Variable width (`width::variable_outline`) and brushes (`brush::outline`) replace the centred band and then go through the same inside/outside clip.

### Stroke paint

- **Same type as fill.** `Node.strokes` is `Vec<Paint>`, and the renderer paints fills and strokes through the same `fill_with(pix, path, paints, w, h, xf, rule, ctx, mask)`. A stroke is just the stroke-area path filled with the stroke paints.
- **Supported:** solid, linear, radial, angular, diamond, image, pattern. All of them work on strokes because the path is filled like any other.
- **Not present:** video. The closest thing is animated GIF frames (`images::frame_at`). Noise is an effect (`EffectKind`), not a paint.
- **Gradient space:** handles `from`, `to`, `width` are in the node's unit box, not the stroke's bounds (`paint.rs` `handle_frame`). A stroke gradient therefore lines up with a fill gradient on the same node.
- **Diamond** has no tiny-skia shader: a 256×256 pixmap is sampled once and mapped through the handle frame (`paint.rs` `diamond_pixmap`).
- **Blend mode** is per paint (`ts_blend`). Plus darker has no tiny-skia mode and is composited separately (`fill_with`, `fx::plus_darker`).
- **Image adjustments** (`ImageFilters`: exposure, contrast, saturation, temperature, tint, highlights, shadows, each −1..1) are baked into the decoded pixmap by `images::apply_filters` and cached per image and filter set. Because they live in the pixmap, they apply to a stroke exactly as to a fill.

### Non-solid strokes in exports and prototype

| Target | How a stroke is written | Non-solid paints |
|---|---|---|
| SVG (`crates/svg/src/lib.rs` `stroke_paths`, `paint_attr`) | The `stroke_area` path as a filled `<path>`, one per paint. With `simplify_stroke`, a simple stroke becomes real `stroke` attributes (`simple_stroke`). | Linear → `<linearGradient>`. Image → `<pattern>` with an embedded image. Pattern → `<pattern>` holding the source's vectors (`pattern_tiles`), or a PNG of the cell when the source has effects. |
| PDF (`crates/pdf/src/draw.rs` `fill`, `vector_paint`) | The `stroke_area` path filled. | Solid, linear and radial stay vector. Angular and diamond are rasterised and clipped to the path (`raster_paint`). Image is embedded. Pattern is a PDF tiling pattern (`pattern_fill`), rasterised when the source has effects. |
| Prototype (`crates/ui-egui/src/present/draw.rs`, `actions.rs`) | The presenter calls `figcraft_render::render_node` and shows the pixels. | Identical to the canvas, because it is the same renderer. |

Two gaps I found in the SVG exporter:

- **Angular and diamond are written as `<radialGradient>`.** In `paint_attr` every non-linear gradient kind takes the same `_ =>` branch, so they will not look like the canvas.
- **Image adjustments are dropped.** `paint_attr` embeds the original image bytes and never reads `img.filters`. PDF keeps them (it embeds decoded pixels when adjustments apply, per the `pdf/src/lib.rs` header).

### Pattern paint

- `PatternPaint { source: u64, tile, scale, spacing: (f64, f64), align }` (`crates/color/src/lib.rs`). `source` is a node id.
- `PatternTile`: `Grid`, `HorizontalHex` (every other row shifted half a tile), `VerticalHex`.
- `PatternAlign`: `Start`, `Center`, `End`: where the grid starts in the filled box.
- `PatternPaint::cell(tw, th, w, h)` returns one repeating `PatternCell { size, origin, tiles, scale }`. Hex cells are two rows or columns tall and list the shifted tile on both sides so it wraps.
- Limits: scale 0.01–100, spacing 0–10 000.
- Rendering (`crates/render/src/pattern.rs` `cell_pixmap`, `prepare`): the source node is drawn into one cell pixmap at the display resolution (max 2048 px a side) and repeated by a tiling shader. Nesting is capped at 2 levels.

### Variable binding on paints

- A node stores resolved values plus `bound: BTreeMap<String, VariableId>`. `derived::normalize` calls `cmd::styles::apply_bindings_to`, which writes each variable's value into the node.
- Keys (`crates/engine/src/cmd/lists.rs` `list_binding`, `stop_binding`):
  - `fills/<i>/color`, `strokes/<i>/color` (`fill` and `stroke` are aliases for index 0).
  - `fills/<i>/stops/<j>/color` for gradient stops. The `variable.bind` doc string names fills only, but `remap_stop_bindings` and `apply_paint_bindings_on_load` handle strokes the same way.
  - `strokeWeight` and the four per-side weights (`cmd/styles.rs` `bound_field`).
- Bindings follow their items when a list is reordered or a stop is removed (`lists.rs` `move_item`, `remap_stop_bindings`).
- `Paint.color_alpha` separates the alpha that came from a colour from an opacity set by hand, so binding a colour variable replaces only the colour's share (`rebind_paint_alpha`).
- **Not bindable, as far as I found:** pattern scale, spacing, source, tile type, and image paint parameters.

## 4. Fill picker

The picker is `crates/ui-egui/src/widgets/colorpicker.rs`; the Fill and Stroke rows are `panels/right/paints.rs` (`paints`, `paint_row`). One `PickerTarget` covers fills, strokes, text ranges, styles and the page background, so fills and strokes share the same window.

| UI | Model | Code |
|---|---|---|
| Type row: Solid, Linear, Radial, Angular, Diamond, Image, Pattern (seven segments) | `PaintKind` variant; the four gradients are `Gradient.kind` | `paint_type_row` |
| Gradient stops and handles | `Gradient.stops`, `from`, `to`, `width` | `gradient_controls` |
| Image: scale mode, rotation, adjustments, presets | `ImagePaint.scale_mode`, `rotation`, `crop`, `filters`; `ImageFilters::PRESETS` | `image_controls`, `image_presets` |
| Pattern: source, tile type, alignment, scale, spacing X and Y | `PatternPaint` fields | `pattern_controls` |
| Blend dropdown | `Paint.blend`, 19 modes in `BlendMode::ALL` | `blend_row` |
| Video | none | none |
| Noise | none as a paint (it is an effect) | none |

Notes:

- Switching gradient kind keeps the stops. Switching to Solid uses `Paint::preview_color`.
- Image is not written until a file is chosen (`image_pending`).
- Every edit goes through `write`, which runs an engine command; drags are live previews closed by `finish`.

## 5. Midas gap analysis

### Mapping

| FigCraft | Midas equivalent | Difference |
|---|---|---|
| `Paint` / `PaintKind` (`color`) | fill objects in `packages/builder-core/src/geometry/fills.js` (`type`: solid, linear, radial, angular, diamond, pattern, image, video) | Midas has video. Midas fills are untyped JS objects. |
| `Node.strokes: Vec<Paint>` | `n.stroke` (a colour) plus one optional `n.strokeFill` | Midas has one stroke paint, in two fields that must be kept in step (`ensureStrokeFill` in `midas.js`). |
| `StrokeProps` | flat node fields: `strokeWidth`, `strokeAlign`, `strokeJoin`, `strokeCap`, `strokeStyle`, `strokeDash`, `strokeGap`, `strokeMiter`, `strokeSides`, `strokeT/R/B/L` (`geometry/shapes.js`) | No arrowheads, width profile, brush or dash cap. One dash and one gap. |
| `stroke_area` (one function) | four routes: `paintStroke` in `midas.js` (Canvas 2D, clip and double width); the shader band (`insideStrokeOnShader`); `svgStrokeAttrs` / `svgStrokeExtra` in `shapes.js` (SVG clip or mask); CSS borders and an SVG overlay in `prototype/dom-tree.js` | Each route has its own rules for inside, outside and per-side. |
| Inside/outside by boolean | by clip path (canvas) or clip/mask (SVG) | Same idea. Midas's result is not a path, so it cannot feed shadows, booleans or outline-stroke. |
| `pathops` booleans (`linesweeper`, curves) | `geometry/boolean.js` on `polygon-clipping` (flattened polygons) | FigCraft keeps curves. |
| `render` (tiny-skia, CPU) | `midas.js` WebGPU analytic primitives, a Canvas 2D raster atlas (`atlasPacker.js`), and a Canvas 2D fallback | Midas draws on the GPU. |
| `svg` exporter | `exportSVG` in `midas.js` | FigCraft also exports PDF and Android Vector Drawable. Midas exports SVG and PNG. |
| Prototype = renderer pixels | Play = real DOM (`prototype/dom-tree.js`) plus the generated stylesheet | Different by design. Midas's Play is the product; FigCraft's is a picture. |
| `PatternPaint` drawn from the source node | `patternTileOf`, `patternCellOf`, `patternPhaseOf`, with the tile as a raster asset (`patternTileId`) | Same three tile types. Midas tiles an image of the source. |
| `Node.bound` keys `fills/<i>/…` | `n.vars` keys `fills.N`, `fills.N.stop.K`, `fills.N.<param>` (`fillParamType`, `parseStopKey`) | Midas binds pattern and video parameters. Midas has no stroke stop keys that I found. |
| `spec!` command registry | `transaction(label, fn)` in `midas.js` mutating nodes directly | FigCraft has one typed entry point per behaviour. |
| `History` of `Arc<Document>` | `history.begin/undo/redo` in `midas.js` | Not compared in detail. |
| `colorpicker.rs` | `pickerTypesHtml` and `PK_TYPES` in `midas.js`: Solid, Gradient, Pattern, Image, Video, with a blend menu | Midas disables plus-darker and plus-lighter (`PK_BLEND_UNSUPPORTED`). |

### What FigCraft does better

- **One stroke geometry for every surface.** Canvas, SVG, PDF, shadows and booleans cannot disagree about where a stroke is.
- **Strokes are paths.** Outline stroke, boolean operands with strokes and exact shadows fall out of that.
- **Several stroke paints per node**, sharing the fill paint type with no second field.
- **Stroke features:** arrowheads, dash fitting on open paths, dash caps, per-side strokes on rounded corners that match CSS, variable width, brushes.
- **Angular and diamond gradients on strokes** on the canvas. In Midas's Play an angular stroke draws as its first colour (`paint-server.js` `gradientServer`).
- **One command path with rollback.** A failed or panicking command restores the document.
- **Enforced layering** and a "never crash" lint set.
- **PDF export.**

### What Midas has that FigCraft lacks

- **The behaviour engine:** schema-driven templates, the token chain (Primitives → Semantic → component), Auto Fix, diagnostics (`behavior-engine/`, 8.3k lines; `templates/`, 2.3k).
- **Play as real DOM** with real inputs, focus, hover and motion, and a typed React export with a canvas/Play/export parity gate.
- **GPU canvas** for plain shapes.
- **Video paint.**
- **Variable binding on paint parameters** (pattern source, tile type, scale, spacing; video source and mode).
- **Composite typography variables and effect variables.** FigCraft variables are colour, number, string and boolean.

## 6. Migration plan

### Constraints that shape the plan

- **Canvas is the source of truth; Play derives from the node tree.** Play is DOM, so the browser lays out and shapes its text. If the canvas shaped text in Rust (as FigCraft does with harfrust), canvas and Play would drift and the parity gate would fail. **Text measurement and text rasterising stay in the browser.**
- **No legacy, no shims** (`AGENTS.md`). Each phase deletes the JS it replaces in the same change. There is no period with two implementations.
- **builder-core is synchronous and runs in both Node tests and Vite.** WASM must be ready before the first call. That means an init at module load (top-level `await`) in both environments. This is the first thing Phase 0 must settle.
- **No Rust toolchain on this machine.** `cargo`, `rustc` and `wasm-pack` are not on the PATH.
- **A panic in WASM cannot be caught.** Rust code must return errors, as FigCraft's lints force.
- **A Rust core is not in `docs/roadmap.md` or `docs/behavior-spec.md`.** The spec is the source of truth, so it needs a decision there before any phase starts.

### What stays in JS and what moves

| Stays in JS | Moves to Rust |
|---|---|
| Panels and the React shell (`apps/studio/src`) | Paint and stroke model, stroke geometry (Phase 1) |
| Play runtime: `dom-tree.js`, events, press, toggle, FLIP | Gradient, pattern and image placement maths; binding key remaps (Phase 2) |
| Text measuring, text editing, IME | Document model, variables and modes, transactions and undo (Phase 3) |
| Video elements, file pickers, clipboard | Auto layout, booleans, vector bounds (Phase 4) |
| Templates as data (they are data today) | Display list and atlas planning (Phase 5) |
| WebGPU presentation and WGSL, at least through Phase 4 | SVG export and the CSS/JSX emitters (Phase 6) |
| Server (`apps/server`) | |

### Phases

Sizes are rough: lines of new Rust including tests, and calendar time for one person who knows both codebases. Treat them as order of magnitude.

| Phase | Scope | Risk | Size |
|---|---|---|---|
| 0. Bridge | Toolchain, a Rust workspace inside the repo, the WASM build, loading in Node tests and in Vite, CI. One trivial function end to end. | Low. The sync-init question may force a change to how builder-core is imported. | Config only. 2–4 days. |
| 1. Paint, Stroke, stroke geometry | See below. | Medium. | 1.5–2.5k Rust; 300–500 JS lines changed. 2–3 weeks. |
| 2. Paint maths | Port the pure half of `fills.js` (1.0k lines): stops, handles, pattern cell and phase, image placement, crop, key remaps. Emit SVG paint servers from Rust. Fix angular strokes in Play. | Low to medium. Many existing tests compare strings, so number formatting must match exactly. | 1.5–2k Rust. 2–3 weeks. |
| 3. Document model and undo | Typed nodes, variables, modes, typography and effect values, transactions, snapshots. `midas.js` (24k lines) mutates plain objects everywhere and would talk to Rust through commands instead. | **High.** This rewrites most of the studio engine and every test that builds a node by hand. | 8–12k Rust; 10k+ JS lines rewritten. 2–4 months. |
| 4. Layout and geometry | Auto layout, booleans on curves (`linesweeper` in place of `polygon-clipping`), bounds, hit testing. Text sizes come in from JS. | Medium to high. Hug sizing depends on text measured in JS, so layout needs a callback or a pre-measure pass. | 4–6k Rust. 1–2 months. |
| 5. Renderer | Rust builds a display list (paths, paints, tiles); the existing WebGPU code presents it. Optionally raster non-text tiles with tiny-skia in a worker. | **High.** Little is gained unless Phase 3 is done. FigCraft's renderer is CPU only and is not a model for a GPU canvas. | 5–10k Rust. 2–3 months. |
| 6. Export | SVG from the Rust model using the shared stroke area. CSS and JSX emitters from `codegen.js`. PDF is new work (FigCraft uses `krilla`). | Medium. The export parity gate already exists to catch drift. | 4–6k Rust. 1–2 months. |

### Phase 1 in detail

Goal: prove the bridge on the smallest piece that has real value, with existing tests as the judge.

Scope:

1. **Model.** `Paint` (kind, opacity, visible, blend) with kinds solid, linear, radial, angular, diamond, image, pattern, video. `Stroke` with weight, align, join, cap, miter, dash, gap, per-side weights. One conversion from Midas's node fields at the boundary.
2. **Pure stroke rules.** The functions `shapes.js` exports today, with the same names and results: `strokeIsOn`, `strokeClosed`, `strokeSideWidths`, `strokeWeightOf`, `strokeSidesUniform`, `strokeDashArray`, `strokeMiterLimit`.
3. **Stroke area.** One function that returns the stroke of a node as path commands plus a fill rule, built the way `stroke_area` is: per-side route, ring shortcut, general outline with inside/outside by boolean.
4. **One consumer switched:** the Canvas 2D raster route (`paintStroke` in `midas.js`) fills that path. The JS it replaces is deleted.

Verification with tests that exist today:

- `packages/builder-core/test`: `geometry-shapes`, `stroke-sides`, `stroke-style`, `stroke-panel`, `stroke-paint`, `bound-stroke`, `button-stroke`, `variant-stroke`, `single-border`, `play-stroke`, `prototype-dash`.
- `apps/studio/test`: `strokePanel`, `inside-stroke-route`, `rasterRoutes`, `dividerRaster`, `exportSvgReplay`.
- Browser: the parity gate (`npm run test:browser --workspace @midas/studio`), which measures canvas against Play within 0.5 px.

Limits of that verification:

- The unit tests cover items 1 and 2 directly. They do **not** check canvas pixels, so item 4 is judged only by the browser gate.
- Tests on `svgStrokeAttrs` and `svgStrokeExtra` assert the clip and mask markup. Phase 1 leaves SVG export and Play alone so those tests stay valid; moving them to the shared path is Phase 2 or 6 and changes their expectations.
- Midas defaults to round joins and caps; FigCraft defaults to miter and none. The port keeps Midas's defaults.

What Phase 1 should answer before going further:

- How large is the WASM for this slice, and how long does it take to load?
- What does one call across the boundary cost for a node, and is it acceptable per frame?
- Does the kurbo outline match the browser's own stroker closely enough for the parity gate?

### Recommendation

Do Phase 0 and Phase 1, then stop and measure. Phase 2 is a safe follow-up. Phases 3 and 5 only make sense together, and they are a rewrite of the studio engine; the evidence from FigCraft supports the shared geometry and model, not a faster canvas.

## Not verified

- I did not build or run FigCraft. Everything is from reading source.
- Dependency licences (`kurbo`, `linesweeper`, `tiny-skia`, `krilla`) were not checked crate by crate.
- Midas's `history` object (how undo stores state) was not read.
- Whether FigCraft's SVG exporter handles angular and diamond gradients somewhere outside `paint_attr` (for example by rasterising the whole node first in `raster_whole`) was not traced.
- The WASM size of a core-only slice is unknown; 22.2 MiB is the whole FigCraft app.
- Phase sizes are estimates from line counts, not from a prototype.
