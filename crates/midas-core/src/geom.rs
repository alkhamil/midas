//! Path commands in, kurbo paths out, and back to SVG path data.
//!
//! The command set is the one `geometry/shapes.js` gives (`pathCommands`): `M`, `L`, `C`, `Z`, `E`
//! (an arc of an ellipse from the current point) and `R` (a rounded rectangle, a sub-path of its own).
//! Parts of the arc and rectangle helpers are adapted from FigCraft (`figcraft_geom`), MIT OR Apache-2.0,
//! Copyright (c) 2026 ArtCraft Team and the FigCraft contributors. See THIRD_PARTY_NOTICES.

use kurbo::{Arc, BezPath, PathEl, Point, Rect, RoundedRect, RoundedRectRadii, Shape};
use serde::Deserialize;

/// One drawing command of a layer outline.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(tag = "op")]
pub enum Cmd {
    M { x: f64, y: f64 },
    L { x: f64, y: f64 },
    C { x1: f64, y1: f64, x2: f64, y2: f64, x: f64, y: f64 },
    Z,
    E { cx: f64, cy: f64, rx: f64, ry: f64, start: f64, end: f64, #[serde(default)] ccw: bool },
    R { w: f64, h: f64, radii: [f64; 4] },
}

/// Largest magnitude a coordinate may have: the sweep needs bounded input.
pub const MAX_COORD: f64 = 1e9;

/// The tolerance an arc of radius `r` is flattened at (kurbo's cubic count grows with radius over tolerance).
pub fn arc_tolerance(r: f64) -> f64 {
    if r.is_finite() { (r.abs() * 1e-6).max(0.01) } else { f64::INFINITY }
}

/// Every coordinate of `path` is finite and of a sane magnitude.
pub fn finite_path(path: &BezPath) -> bool {
    path.elements().iter().all(|el| match el {
        PathEl::MoveTo(p) | PathEl::LineTo(p) => finite_pt(*p),
        PathEl::QuadTo(a, b) => finite_pt(*a) && finite_pt(*b),
        PathEl::CurveTo(a, b, c) => finite_pt(*a) && finite_pt(*b) && finite_pt(*c),
        PathEl::ClosePath => true,
    })
}

fn finite_pt(p: Point) -> bool {
    p.x.is_finite() && p.y.is_finite() && p.x.abs() <= MAX_COORD && p.y.abs() <= MAX_COORD
}

/// A rounded rectangle at the origin with radii `[tl, tr, br, bl]` (each clamped to half the shorter side).
pub fn rounded_rect(w: f64, h: f64, radii: [f64; 4]) -> BezPath {
    let m = (w.min(h) / 2.0).max(0.0);
    let r = radii.map(|v| if v.is_finite() { v.clamp(0.0, m) } else { 0.0 });
    if r.iter().all(|v| *v == 0.0) {
        return Rect::new(0.0, 0.0, w, h).to_path(0.1);
    }
    RoundedRect::from_rect(Rect::new(0.0, 0.0, w, h), RoundedRectRadii::new(r[0], r[1], r[2], r[3])).to_path(0.05)
}

/// The path of a command list. An `E` continues the current point (a line to its start when a sub-path is open, a move when none is),
/// a full turn closes itself, and an `R` is a closed sub-path of its own.
pub fn path_of(cmds: &[Cmd]) -> BezPath {
    let mut p = BezPath::new();
    let mut open = false;
    for c in cmds {
        match *c {
            Cmd::M { x, y } => {
                p.move_to((x, y));
                open = true;
            }
            Cmd::L { x, y } => {
                if open { p.line_to((x, y)) } else { p.move_to((x, y)) }
                open = true;
            }
            Cmd::C { x1, y1, x2, y2, x, y } => {
                if !open {
                    p.move_to((x1, y1));
                }
                p.curve_to((x1, y1), (x2, y2), (x, y));
                open = true;
            }
            Cmd::Z => {
                if open {
                    p.close_path();
                }
                open = false;
            }
            Cmd::E { cx, cy, rx, ry, start, end, .. } => {
                let (rx, ry) = (rx.abs().max(1e-3), ry.abs().max(1e-3));
                let sweep = end - start;
                let from = Point::new(cx + start.cos() * rx, cy + start.sin() * ry);
                if open { p.line_to(from) } else { p.move_to(from) }
                open = true;
                Arc::new((cx, cy), (rx, ry), start, sweep, 0.0).to_cubic_beziers(arc_tolerance(rx.max(ry)), |a, b, e| p.curve_to(a, b, e));
                if sweep.abs() >= std::f64::consts::TAU - 1e-6 {
                    p.close_path();
                    open = false;
                }
            }
            Cmd::R { w, h, radii } => {
                p.extend(rounded_rect(w, h, radii).elements().iter().copied());
                open = false;
            }
        }
    }
    p
}

/// A number as SVG path data: at most three decimals, no trailing zeros, no `-0`.
pub fn num(v: f64) -> String {
    let r = (v * 1000.0).round() / 1000.0;
    let r = if r == 0.0 { 0.0 } else { r };
    format!("{r}")
}

/// The SVG path data of `path`.
pub fn svg_d(path: &BezPath) -> String {
    let mut d = String::new();
    for el in path.elements() {
        match el {
            PathEl::MoveTo(p) => d.push_str(&format!("M{} {}", num(p.x), num(p.y))),
            PathEl::LineTo(p) => d.push_str(&format!("L{} {}", num(p.x), num(p.y))),
            PathEl::QuadTo(a, b) => d.push_str(&format!("Q{} {} {} {}", num(a.x), num(a.y), num(b.x), num(b.y))),
            PathEl::CurveTo(a, b, c) => d.push_str(&format!("C{} {} {} {} {} {}", num(a.x), num(a.y), num(b.x), num(b.y), num(c.x), num(c.y))),
            PathEl::ClosePath => d.push('Z'),
        }
    }
    d
}

/// The subpaths of `path`, each starting at its own move.
pub fn split_subpaths(path: &BezPath) -> Vec<BezPath> {
    let mut out = Vec::new();
    let mut cur = BezPath::new();
    for el in path.elements() {
        if matches!(el, PathEl::MoveTo(_)) && !cur.elements().is_empty() {
            out.push(std::mem::take(&mut cur));
        }
        cur.push(*el);
    }
    if !cur.elements().is_empty() {
        out.push(cur);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commands_parse_and_build() {
        let cmds: Vec<Cmd> = serde_json::from_str(r#"[{"op":"M","x":0,"y":0},{"op":"L","x":10,"y":0},{"op":"L","x":10,"y":10},{"op":"Z"}]"#).unwrap();
        let p = path_of(&cmds);
        assert!((p.area().abs() - 50.0).abs() < 1e-9);
        assert_eq!(svg_d(&p), "M0 0L10 0L10 10Z");
    }

    #[test]
    fn an_ellipse_command_is_a_closed_ellipse() {
        let cmds = [Cmd::E { cx: 50.0, cy: 25.0, rx: 50.0, ry: 25.0, start: 0.0, end: std::f64::consts::TAU, ccw: false }];
        let p = path_of(&cmds);
        assert!((p.area().abs() - std::f64::consts::PI * 50.0 * 25.0).abs() < 1.0);
        assert!(matches!(p.elements().last(), Some(PathEl::ClosePath)));
    }

    #[test]
    fn a_rect_command_clamps_its_radii() {
        let p = path_of(&[Cmd::R { w: 20.0, h: 10.0, radii: [100.0, 0.0, 0.0, 0.0] }]);
        let b = p.bounding_box();
        assert!(b.x0.abs() < 1e-6 && b.y0.abs() < 1e-6 && (b.x1 - 20.0).abs() < 1e-6 && (b.y1 - 10.0).abs() < 1e-6, "{b:?}");
        assert!(p.area().abs() < 200.0);
    }

    #[test]
    fn numbers_are_short() {
        assert_eq!(num(1.0), "1");
        assert_eq!(num(-0.0004), "0");
        assert_eq!(num(1.23456), "1.235");
    }
}
