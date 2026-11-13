//! The WASM bindings of `midas-core`, for builder-core (`packages/builder-core/src/core/index.js` types them).
//!
//! Every function takes and returns JSON text; a bad input throws a JS error. There is no logic here: the core is pure Rust, and the
//! same core links natively. Built by `scripts/build-core.mjs` with wasm-pack.
use midas_core::{geom, paint, stroke};
use wasm_bindgen::prelude::*;

/// The version of the core the bridge loaded (the smoke test of the WASM bridge).
#[wasm_bindgen]
pub fn core_version() -> String {
    midas_core::VERSION.to_string()
}

/// The area a stroke paints, as `{"d": <svg path data>, "rule": "evenodd" | "nonzero"}`.
/// `commands` is a layer outline (`pathCommands`) or a text layer's glyph outlines as the same commands; `props` is the stroke geometry
/// (`StrokeProps`). The path is in the layer's own space.
pub fn stroke_area_json(commands: &str, props: &str) -> Result<String, String> {
    let cmds: Vec<geom::Cmd> = serde_json::from_str(commands).map_err(|e| format!("stroke_area: commands: {e}"))?;
    let props: stroke::StrokeProps = serde_json::from_str(props).map_err(|e| format!("stroke_area: props: {e}"))?;
    let (path, rule) = stroke::stroke_area(&cmds, &props).map_err(|e| format!("stroke_area: {e}"))?;
    serde_json::to_string(&serde_json::json!({ "d": geom::svg_d(&path), "rule": rule })).map_err(|e| e.to_string())
}

/// The stroke area of a layer (see [`stroke_area_json`]).
#[wasm_bindgen]
pub fn stroke_area(commands: &str, props: &str) -> Result<String, JsError> {
    stroke_area_json(commands, props).map_err(|e| JsError::new(&e))
}

/// The SVG layer of a stroke paint as `{"defs", "content", "flat"}`, or `null` when there is nothing to draw (a solid or hidden paint, or one that cannot be drawn yet).
pub fn paint_layer_json(paint: &str, id: &str, w: f64, h: f64, src: Option<String>) -> Result<String, String> {
    let paint: paint::Paint = serde_json::from_str(paint).map_err(|e| format!("paint_layer: {e}"))?;
    serde_json::to_string(&paint.layer(id, w, h, src.as_deref())).map_err(|e| e.to_string())
}

/// The SVG layer of a paint (see [`paint_layer_json`]). `src` is the asset the paint draws.
#[wasm_bindgen]
pub fn paint_layer(paint: &str, id: &str, w: f64, h: f64, src: Option<String>) -> Result<String, JsError> {
    paint_layer_json(paint, id, w, h, src).map_err(|e| JsError::new(&e))
}

/// Where an image or a video poster is drawn in a box `w` by `h`, as `{"x", "y", "w", "h", "tile", "rotation"}`, or `null` while it cannot be placed. `iw` and `ih` are
/// the picture's measured size (the canvas has the loaded image); without them the paint's own recorded size is used.
pub fn picture_extent_json(paint: &str, w: f64, h: f64, iw: Option<f64>, ih: Option<f64>) -> Result<String, String> {
    let paint: paint::Paint = serde_json::from_str(paint).map_err(|e| format!("picture_extent: {e}"))?;
    serde_json::to_string(&paint.extent(w, h, iw.zip(ih))).map_err(|e| e.to_string())
}

/// The extent of a picture paint (see [`picture_extent_json`]).
#[wasm_bindgen]
pub fn picture_extent(paint: &str, w: f64, h: f64, iw: Option<f64>, ih: Option<f64>) -> Result<String, JsError> {
    picture_extent_json(paint, w, h, iw, ih).map_err(|e| JsError::new(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_the_core_version() {
        assert_eq!(core_version(), "0.1.0");
    }

    #[test]
    fn stroke_area_speaks_json() {
        let out = stroke_area_json(r#"[{"op":"R","w":100,"h":100,"radii":[0,0,0,0]}]"#, r#"{"weight":10,"align":"inside","join":"miter"}"#).unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["rule"], "evenodd");
        assert!(v["d"].as_str().unwrap().starts_with('M'));
        assert!(stroke_area_json("not json", "{}").unwrap_err().contains("commands"));
        assert!(stroke_area_json("[]", r#"{"align":"sideways"}"#).unwrap_err().contains("props"));
    }

    #[test]
    fn paint_layer_speaks_json() {
        let out = paint_layer_json(r##"{"type":"diamond","stops":[{"pos":0,"color":"#ff0000"},{"pos":1,"color":"#00ff00"}]}"##, "g", 10.0, 10.0, None).unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["flat"].as_bool(), Some(true));
        assert!(v["content"].as_str().unwrap().contains("#ff0000"));
        assert_eq!(paint_layer_json(r##"{"type":"solid","color":"#000000"}"##, "g", 1.0, 1.0, None).unwrap(), "null");
        assert!(paint_layer_json(r#"{"type":"noise"}"#, "g", 1.0, 1.0, None).unwrap_err().contains("paint_layer"));
    }

    #[test]
    fn picture_extent_speaks_json() {
        let image = r#"{"type":"image","image":"a","mode":"fill"}"#;
        let v: serde_json::Value = serde_json::from_str(&picture_extent_json(image, 120.0, 80.0, Some(16.0), Some(16.0)).unwrap()).unwrap();
        assert_eq!((v["w"].as_f64(), v["h"].as_f64(), v["y"].as_f64(), v["tile"].as_bool()), (Some(120.0), Some(120.0), Some(-20.0), Some(false)));
        assert_eq!(picture_extent_json(image, 120.0, 80.0, None, None).unwrap(), "null", "not measured");
    }
}
