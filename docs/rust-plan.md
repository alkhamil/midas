# Midas Rust Plan

Goal: Midas becomes a fast native desktop app with the same capabilities as today (auto design system, auto variables, live Play), built on a Rust core.

## Target architecture

- **Rust core (native):** document model, commands and undo/redo, paint and stroke geometry, auto design system and variable engines, canvas renderer, scene-to-HTML compiler for Play.
- **Tauri shell:** window, native file open/save, shortcuts. Same core crate used natively; WASM remains only for the web dev build.
- **Webview:** panels and the Play surface. Play stays real DOM so inputs are typeable, buttons have real hover/press/focus/disabled state, and links are real links.
- **Canvas is the source of truth.** Play derives from it.

## Principles

1. Strangler approach: Midas must run after every phase. No big-bang rewrite.
2. `midas-core` stays pure Rust (no wasm-bindgen, web-sys, js-sys). Bindings live in thin crates (`midas-wasm`, later a Tauri binding).
3. Send small commands across the bridge, never the whole document back and forth.
4. Measure before and after each phase. Gates decide whether the next heavy phase is needed.
5. Text is measured in the browser until a Rust text engine is proven necessary.
6. FigCraft code may be adapted (MIT OR Apache-2.0) with attribution in file headers and `THIRD_PARTY_NOTICES`. Nothing from its `docs/brand/`.

## Phases

| Phase | Scope | Result | Status |
|---|---|---|---|
| 0 | Rust workspace, WASM bridge, build scripts wired into dev/build/test | JS can call Rust | Done |
| 1 | Paint model + stroke pipeline (`stroke_area`: inside/center/outside, open paths, dashes, joins, caps, per-side) in `midas-core`; canvas, Play and SVG export use it | One stroke implementation, one picture extent | Done (2026-11-13) |
| 2 | Wrap current Midas in Tauri: native open/save, window, shortcuts, Play in its own window | Real desktop app | Not started |
| 3 | Document model, commands, undo/redo in Rust; JS becomes a thin client | Single source of truth | Not started |
| 4 | Auto design system and auto variable engines in Rust (token extraction, component detection, binding) | Heavy logic native | Not started |
| 5 | Canvas renderer in Rust (wgpu or vello), shared scene for canvas | Editor-grade canvas speed | Gated |
| 6 | Scene-to-HTML/CSS compiler in Rust for Play, with incremental DOM patches | Play feels like a live product, and is fast | Not started |
| 7 | UI decision: keep web panels or move to egui | Decision based on data | Gated |

## Phase details

### Phase 0: WASM bridge (done)
- `crates/midas-core` built to WASM via `scripts/build-core.mjs`, run before dev, build, test and test:browser.
- Wrapper in `packages/builder-core/src/core/index.js`, loaded once at import.

### Phase 1: Paint and Stroke (done)
- Paint types: Solid, Linear, Radial, Angular, Diamond, Pattern, Image, Video, with blend mode and image adjustments (`midas-core/src/paint.rs`).
- `stroke_area` (`stroke.rs`): inside/centre/outside, open paths, glyph outlines as commands, dashes, joins, caps, per-side widths. A stroke paint is a layer (`paint_layer`) clipped by the area path, in the canvas raster route, Play and the SVG export.
- One `picture_extent` (fill, fit, crop, tile) used by the canvas and Play; one `gradientRaster` (`paint-raster.js`) for the canvas pattern and Play's angular/diamond strokes. Play redraws a stroke area and its paint on resize, cached by size.
- Decision: Angular/Diamond in Play are a raster of the canvas's gradient clipped by the stroke area (match canvas); the SVG export keeps the first-stop colour and never writes `radialGradient` (documented in `docs/behavior-spec.md`).
- Crate split: `midas-core` is pure Rust; `midas-wasm` is the thin binding. Browser test infra: servers started once, production build behind `vite preview` (`--dev` falls back), one browser per file, saved sign-in; the full suite went from 2473 s to 2055 s.
- Exit criteria met: `stroke-area.browser.test.mjs` (every alignment, shape, paint, dash and per-side case; canvas vs Play within 4%, paints 0 to 1.1%) green; the full browser suite has the same failures as HEAD; perf baseline recorded in `docs/perf-baseline.md` (headless and headed, WebGPU on an integrated Intel Iris Xe).
- Left over: text strokes stay on the browser's `strokeText` (no glyph outline source yet); fills still use the CSS/data-URL picture layouts in `fills.js`; Docker builds need a Rust toolchain; Play's angular/diamond rasters cost a `toDataURL` read-back per paint and size (the top hotspot at 5k and 20k layers).

### Phase 2: Tauri shell
- Scope: Tauri project around the existing app, native file dialogs and save, window management, keyboard shortcuts, Play in a separate window.
- Core crate called natively where useful; WASM path kept for web dev.
- Exit criteria: Midas runs as a desktop app with feature parity; installer builds on Windows.

### Phase 3: Document model in Rust
- Nodes, paints, strokes, effects, variables, components and instances in Rust.
- Command API with undo/redo; JS sends commands and reads snapshots or diffs.
- Rules carried over: clean layer trees, no hidden layers; part/slot layers are added and removed with their props.
- Exit criteria: all editing flows go through commands; existing test suites green; hit-testing and tree traversal measured against baseline.

### Phase 4: Auto design system and auto variables
- Token extraction, component detection, variable binding implemented in Rust against the Phase 3 model.
- Exit criteria: same outputs as the current JS implementation on a fixture set, faster on large documents.

### Phase 5: Rust canvas renderer (gated)
- Enter only if profiling after Phases 1 to 4 still shows canvas as the bottleneck.
- Scope: wgpu or vello renderer fed by the Rust scene; text still measured in the browser unless a text engine (e.g. cosmic-text) is justified.
- Exit criteria: pan/zoom and drag meet the target frame time at 5k and 20k nodes.

### Phase 6: Play compiler
- Rust compiles the scene to HTML/CSS and sends incremental patches on edit.
- Hover, active, focus and disabled via CSS pseudo-classes, not JS re-render.
- Inputs are real `<input>`/`<textarea>`, links are real `<a>` with navigation between frames, user-set URLs supported.
- Exit criteria: entering Play and state response meet the baseline targets; canvas and Play parity gate green.

### Phase 7: UI decision (gated)
- Keep web panels, or move panels to egui as FigCraft does.
- Decide with data from Phases 1 to 6. Moving to egui means rewriting every panel and giving up HTML/CSS for UI; Play stays DOM regardless.

## Risks

- **Text on canvas:** editing and shaping text in a Rust renderer needs a text engine. Keep the browser overlay until proven necessary.
- **Bridge cost:** large payloads across JS/Rust can erase the gains. Use commands and diffs.
- **Phases 3 and 5** are the heaviest. Do one at a time and keep Midas runnable.
- **Test coverage:** Rust unit tests verify models and geometry, not canvas pixels. The browser parity gate stays the pixel check.
- **Headless test GPU:** headless Chromium has no WebGPU adapter (software rendering). Performance numbers must be taken headed on real hardware.
- **Docker files:** no Rust toolchain yet; builds stop at the core pre-hook until updated.

## Gates

- **After Phase 1:** perf baseline (headless and headed) written to `docs/perf-baseline.md`. Done.
- **Before Phase 5:** profiling must show canvas rendering is still the bottleneck.
- **Before Phase 7:** compare web panels vs egui on measured cost and capability.
