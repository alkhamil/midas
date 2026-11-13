//! The stroke pipeline: one function turns any stroke into the path it paints.
//!
//! Adapted from FigCraft (`figcraft_pathops::stroke_outline_of`, `rect_side_strokes`, `rounded_side_strokes`, `width::dash_pattern`
//! and `figcraft_render::draw::stroke_area`), MIT OR Apache-2.0, Copyright (c) 2026 ArtCraft Team and the FigCraft contributors.
//! Changed for Midas: Midas's own names and defaults (round joins and caps), one dash and one gap, no arrowheads, width
//! profile or brush, no corner smoothing, dashes run as written (no fitting to an open line), and plain `Result` errors.
//! See THIRD_PARTY_NOTICES.

use crate::geom::{self, Cmd};
use kurbo::{BezPath, Cap, Join, PathEl, Rect, Shape};
use serde::{Deserialize, Serialize};

/// Where the stroke sits on the outline. Open paths are always centred.
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Align {
    Inside,
    #[default]
    Center,
    Outside,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StrokeJoin {
    Miter,
    #[default]
    Round,
    Bevel,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StrokeCap {
    #[serde(alias = "none")]
    Butt,
    #[default]
    Round,
    Square,
}

/// How the stroke area is filled: the area of a ring or a per-side stroke is even-odd, a centred band is non-zero.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Rule {
    NonZero,
    EvenOdd,
}

/// The stroke geometry of one layer (the node's `stroke*` fields at the boundary).
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct StrokeProps {
    pub weight: f64,
    pub align: Align,
    pub join: StrokeJoin,
    pub cap: StrokeCap,
    pub miter_limit: f64,
    /// Dash, gap, ... (empty: solid).
    pub dashes: Vec<f64>,
    /// Per-side weights `[top, right, bottom, left]` (rectangles and frames only).
    pub sides: Option<[f64; 4]>,
    /// Whether the shape is closed (inside and outside apply only to closed shapes).
    pub closed: bool,
    /// The shape fills even-odd (an inside or outside stroke clips against its own holes).
    pub even_odd: bool,
}

impl Default for StrokeProps {
    fn default() -> Self {
        Self {
            weight: 1.0,
            align: Align::Center,
            join: StrokeJoin::Round,
            cap: StrokeCap::Round,
            miter_limit: 4.0,
            dashes: Vec::new(),
            sides: None,
            closed: true,
            even_odd: false,
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum StrokeError {
    /// The input holds NaN, an infinity or a coordinate beyond `MAX_COORD`.
    BadInput,
    /// The shape is past the segment budget the sweep accepts.
    TooComplex,
}

impl std::fmt::Display for StrokeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BadInput => write!(f, "the path holds invalid coordinates"),
            Self::TooComplex => write!(f, "the shape is too complex for a stroke outline (over {MAX_SEGMENTS} segments)"),
        }
    }
}

/// The most segments a boolean accepts; past it the stroke is refused rather than run for unbounded time.
pub const MAX_SEGMENTS: usize = 50_000;
/// The widest stroke outlined: past this the maths overflows and nothing visible changes.
pub const MAX_STROKE_WIDTH: f64 = 1e6;
/// The most dashes one stroke draws; a finer pattern draws solid.
const MAX_DASHES: f64 = 20_000.0;

fn kcap(c: StrokeCap) -> Cap {
    match c {
        StrokeCap::Butt => Cap::Butt,
        StrokeCap::Round => Cap::Round,
        StrokeCap::Square => Cap::Square,
    }
}

fn kjoin(j: StrokeJoin) -> Join {
    match j {
        StrokeJoin::Miter => Join::Miter,
        StrokeJoin::Bevel => Join::Bevel,
        StrokeJoin::Round => Join::Round,
    }
}

/// The dash pattern a stroke uses (odd lengths repeat twice), or `None` for a solid stroke.
pub fn dash_pattern(dashes: &[f64]) -> Option<Vec<f64>> {
    let d: Vec<f64> = dashes.iter().copied().filter(|v| v.is_finite() && *v >= 0.0).collect();
    if d.is_empty() || d.iter().sum::<f64>() <= 0.01 {
        return None;
    }
    Some(if d.len() % 2 == 1 { [d.clone(), d].concat() } else { d })
}

fn dashes_fit(len: f64, pattern: &[f64]) -> bool {
    len / pattern.iter().sum::<f64>() * (pattern.len() as f64) < MAX_DASHES
}

/// A centred stroke of `path` at `width`.
fn stroke_center(path: &BezPath, width: f64, p: &StrokeProps) -> BezPath {
    if !(width.is_finite() && width > 0.0 && geom::finite_path(path)) {
        return BezPath::new();
    }
    let width = width.min(MAX_STROKE_WIDTH);
    let style = kurbo::Stroke::new(width)
        .with_join(kjoin(p.join))
        .with_miter_limit(p.miter_limit.clamp(1.0, 100.0))
        .with_start_cap(kcap(p.cap))
        .with_end_cap(kcap(p.cap));
    let subpaths = path.elements().iter().filter(|e| matches!(e, PathEl::MoveTo(_))).count() as f64;
    // A zero-length dash is a dot of its round cap.
    let dots = p.cap == StrokeCap::Round;
    let pattern = dash_pattern(&p.dashes).map(|d| d.into_iter().map(|v| if dots && v == 0.0 { 1e-3 } else { v }).collect::<Vec<_>>());
    let opts = kurbo::StrokeOpts::default();
    let Some(pat) = pattern.filter(|d| dashes_fit(path.perimeter(1.0) + subpaths * d.iter().sum::<f64>(), d)) else {
        return kurbo::stroke(path.iter(), &style, &opts, 0.05);
    };
    let mut out = BezPath::new();
    for sub in geom::split_subpaths(path) {
        out.extend(kurbo::stroke(sub.iter(), &style.clone().with_dashes(0.0, pat.iter().copied()), &opts, 0.05));
    }
    out
}

/// Close every open subpath (a filled open path paints as if closed). A subpath of a lone move fills nothing and is left out.
fn closed(path: &BezPath) -> BezPath {
    let mut out = BezPath::new();
    let mut open = false;
    let mut pending: Option<PathEl> = None;
    for el in path.elements() {
        match el {
            PathEl::MoveTo(_) => {
                if open {
                    out.close_path();
                }
                open = false;
                pending = Some(*el);
                continue;
            }
            PathEl::ClosePath => open = false,
            _ => open = true,
        }
        if let Some(m) = pending.take() {
            out.push(m);
        }
        out.push(*el);
    }
    if open {
        out.close_path();
    }
    out
}

/// Run the sweep library; on native a panic in it is bad input (on wasm a panic aborts, as in FigCraft).
fn sweep<T>(f: impl FnOnce() -> Result<T, StrokeError>) -> Result<T, StrokeError> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).unwrap_or(Err(StrokeError::BadInput))
}

fn contours_path(c: &linesweeper::topology::Contours) -> BezPath {
    let mut out = BezPath::new();
    for contour in c.contours() {
        out.extend(contour.path.elements().iter().copied());
    }
    out
}

/// The area `p` fills under `rule` as simple contours, which non-zero then reads the same.
fn simple(p: &BezPath, rule: linesweeper::FillRule) -> Result<BezPath, StrokeError> {
    if p.elements().is_empty() {
        return Ok(BezPath::new());
    }
    let c = sweep(|| linesweeper::binary_op(p, &BezPath::new(), rule, linesweeper::BinaryOp::Union).map_err(|_| StrokeError::BadInput))?;
    Ok(contours_path(&c))
}

/// A boolean of two paths: `a` is read non-zero, `b` by `rule_b`.
fn boolean(a: &BezPath, b: &BezPath, rule_b: linesweeper::FillRule, op: linesweeper::BinaryOp) -> Result<BezPath, StrokeError> {
    if a.elements().is_empty() && b.elements().is_empty() {
        return Ok(BezPath::new());
    }
    if !geom::finite_path(a) || !geom::finite_path(b) {
        return Err(StrokeError::BadInput);
    }
    let (a, b) = (closed(a), closed(b));
    if a.elements().len() + b.elements().len() > MAX_SEGMENTS {
        return Err(StrokeError::TooComplex);
    }
    // The sweep reads both operands by one rule: an even-odd operand is flattened to simple contours first, which read the same either way.
    let b = if rule_b == linesweeper::FillRule::EvenOdd { simple(&b, rule_b)? } else { b };
    let c = sweep(|| linesweeper::binary_op(&a, &b, linesweeper::FillRule::NonZero, op).map_err(|_| StrokeError::BadInput))?;
    Ok(contours_path(&c))
}

/// The painted stroke of `shape` (a layer outline) as a fill path, by the general route: a centred band, and for Inside and Outside
/// that band at twice the weight clipped against the shape (intersection, difference).
pub fn stroke_outline(shape: &BezPath, props: &StrokeProps) -> Result<BezPath, StrokeError> {
    if !geom::finite_path(shape) {
        return Err(StrokeError::BadInput);
    }
    let w = props.weight;
    if !(w.is_finite() && w > 0.0) {
        return Ok(BezPath::new());
    }
    let w = w.min(MAX_STROKE_WIDTH);
    let align = if props.closed { props.align } else { Align::Center };
    let rule = if props.even_odd { linesweeper::FillRule::EvenOdd } else { linesweeper::FillRule::NonZero };
    match align {
        Align::Center => Ok(stroke_center(shape, w, props)),
        Align::Inside => boolean(&stroke_center(shape, w * 2.0, props), shape, rule, linesweeper::BinaryOp::Intersection),
        Align::Outside => boolean(&stroke_center(shape, w * 2.0, props), shape, rule, linesweeper::BinaryOp::Difference),
    }
}

/// A command list that is exactly one rounded rectangle: its size and radii.
fn single_rect(cmds: &[Cmd]) -> Option<(f64, f64, [f64; 4])> {
    match cmds {
        [Cmd::R { w, h, radii }] => Some((*w, *h, *radii)),
        _ => None,
    }
}

/// A command list that is exactly one full circle: its size.
fn single_circle(cmds: &[Cmd]) -> Option<(f64, f64)> {
    match cmds {
        [Cmd::E { cx, cy, rx, ry, start, end, .. }]
            if (end - start).abs() >= std::f64::consts::TAU - 1e-6 && (rx - ry).abs() < 1e-6 && (*cx - rx).abs() < 1e-6 && (*cy - ry).abs() < 1e-6 =>
        {
            Some((rx * 2.0, ry * 2.0))
        }
        _ => None,
    }
}

fn non_negative(v: f64) -> f64 {
    if v.is_finite() { v.max(0.0) } else { 0.0 }
}

/// Per-side stroke of a rectangle with corner radii `[tl, tr, br, bl]`, like CSS borders: the outer edge is the rounded rectangle
/// (centre and outside grow its box by half or all of each side's weight, and each non-zero radius with it); the inner edge is inset
/// by each side's weight, with elliptical corners `max(0, R - weight)` across and down (square where either is 0).
pub fn side_strokes(w: f64, h: f64, radii: [f64; 4], sides: [f64; 4], align: Align) -> BezPath {
    let [t, r, b, l] = sides.map(non_negative);
    if t + r + b + l <= 0.0 {
        return BezPath::new();
    }
    let f = match align {
        Align::Inside => 0.0,
        Align::Center => 0.5,
        Align::Outside => 1.0,
    };
    let max_r = non_negative(w.min(h)) / 2.0;
    let radii = radii.map(|v| non_negative(v).min(max_r));
    // Each corner's radius with the weights across and down it, clockwise from the top-left.
    let corners = [(radii[0], l, t), (radii[1], r, t), (radii[2], r, b), (radii[3], l, b)];
    let outer = if align == Align::Inside {
        geom::rounded_rect(w, h, radii)
    } else {
        let grown = corners.map(|(rr, x, y)| if rr > 0.0 { (rr + x * f, rr + y * f) } else { (0.0, 0.0) });
        elliptical_rect(Rect::new(-l * f, -t * f, w + r * f, h + b * f), grown)
    };
    let k = 1.0 - f;
    let inner = Rect::new(l * k, t * k, w - r * k, h - b * k);
    if inner.width() <= 0.0 || inner.height() <= 0.0 {
        return outer;
    }
    let (inset, fit) = fit_corners(inner, corners.map(|(rr, x, y)| ((rr - x * k).max(0.0), (rr - y * k).max(0.0))));
    let hole = elliptical_rect(inner, inset);
    // The hole's corners sit on the outer ones, inside them, unless they were shrunk to fit: then it may leave the outer edge.
    if fit < 1.0
        && let Ok(p) = boolean(&outer, &hole, linesweeper::FillRule::NonZero, linesweeper::BinaryOp::Difference)
    {
        return p;
    }
    let mut p = outer;
    p.extend(hole.reverse_subpaths().elements().iter().copied());
    p
}

/// Corner radii `(rx, ry)` for the inner box, square where either is 0, all shrunk by one factor (returned too) where two on an edge
/// add up to more than it, as CSS shrinks radii.
fn fit_corners(inner: Rect, corners: [(f64, f64); 4]) -> ([(f64, f64); 4], f64) {
    let c = corners.map(|(rx, ry)| if rx > 0.0 && ry > 0.0 { (rx, ry) } else { (0.0, 0.0) });
    let [tl, tr, br, bl] = c;
    let edges = [(inner.width(), tl.0 + tr.0), (inner.width(), bl.0 + br.0), (inner.height(), tl.1 + bl.1), (inner.height(), tr.1 + br.1)];
    let fit = edges.iter().filter(|(_, sum)| *sum > 0.0).fold(1.0_f64, |m, (len, sum)| m.min(len / sum));
    (c.map(|(rx, ry)| (rx * fit, ry * fit)), fit)
}

/// Rectangle `r` with an `(rx, ry)` quarter ellipse at each corner `[tl, tr, br, bl]`.
fn elliptical_rect(r: Rect, [tl, tr, br, bl]: [(f64, f64); 4]) -> BezPath {
    use kurbo::Point;
    use std::f64::consts::{FRAC_PI_2, PI};
    let quarters = [
        (Point::new(r.x1, r.y0), (-1.0, 1.0), tr, -FRAC_PI_2),
        (Point::new(r.x1, r.y1), (-1.0, -1.0), br, 0.0),
        (Point::new(r.x0, r.y1), (1.0, -1.0), bl, FRAC_PI_2),
        (Point::new(r.x0, r.y0), (1.0, 1.0), tl, PI),
    ];
    let mut p = BezPath::new();
    p.move_to((r.x0 + tl.0, r.y0));
    for (corner, (sx, sy), (rx, ry), start) in quarters {
        if rx > 0.0 && ry > 0.0 {
            let c = Point::new(corner.x + sx * rx, corner.y + sy * ry);
            p.line_to((c.x + rx * start.cos(), c.y + ry * start.sin()));
            kurbo::Arc::new(c, (rx, ry), start, FRAC_PI_2, 0.0).to_cubic_beziers(geom::arc_tolerance(rx.max(ry)), |a, b, e| p.curve_to(a, b, e));
        } else {
            p.line_to(corner);
        }
    }
    p.close_path();
    p
}

/// The stroke area of a layer: the path the stroke paints and the rule that fills it.
///
/// Routes, in order: per-side weights (a rectangle with unequal sides), the ring shortcut (a solid inside or outside stroke of a
/// rectangle or a circle is two outlines filled even-odd, no boolean), and the general outline (a centred band, clipped against the
/// shape by a boolean for inside and outside). Text outlines go in as closed commands like any other shape.
pub fn stroke_area(cmds: &[Cmd], props: &StrokeProps) -> Result<(BezPath, Rule), StrokeError> {
    let shape = geom::path_of(cmds);
    if !geom::finite_path(&shape) {
        return Err(StrokeError::BadInput);
    }
    let rect = single_rect(cmds);
    let mut props = props.clone();
    if let Some(s) = props.sides.filter(|s| s.iter().all(|v| (*v - s[0]).abs() < 1e-9)) {
        props.weight = s[0];
        props.sides = None;
    }
    let align = if props.closed { props.align } else { Align::Center };
    if let (Some(sides), Some((w, h, radii)), true) = (props.sides, rect, props.closed) {
        return Ok((side_strokes(w, h, radii, sides, align), Rule::EvenOdd));
    }
    let w = props.weight;
    if props.dashes.is_empty() && props.closed && align != Align::Center && w.is_finite() && w > 0.0 {
        let w = w.min(MAX_STROKE_WIDTH);
        // An outside ring grows square corners as miters; other joins take the general outline.
        let ring = |inset: f64| -> Option<BezPath> {
            if let Some((rw, rh, radii)) = rect {
                if align == Align::Outside && props.join != StrokeJoin::Miter && radii.contains(&0.0) {
                    return None;
                }
                let (ww, hh) = (rw - 2.0 * inset, rh - 2.0 * inset);
                if ww <= 0.0 || hh <= 0.0 {
                    return None;
                }
                let radii = radii.map(|r| if r > 0.0 { (r - inset).max(0.0) } else { 0.0 });
                let mut p = geom::rounded_rect(ww, hh, radii);
                p.apply_affine(kurbo::Affine::translate((inset, inset)));
                return Some(p);
            }
            if let Some((cw, ch)) = single_circle(cmds) {
                let (ww, hh) = (cw - 2.0 * inset, ch - 2.0 * inset);
                if ww <= 0.0 || hh <= 0.0 {
                    return None;
                }
                return Some(kurbo::Ellipse::from_rect(Rect::new(inset, inset, inset + ww, inset + hh)).to_path(0.05));
            }
            None
        };
        let (outer, inner) = if align == Align::Inside { (ring(0.0), ring(w)) } else { (ring(-w), ring(0.0)) };
        if let Some(mut o) = outer {
            if let Some(i) = inner {
                o.extend(i.elements().iter().copied());
            }
            return Ok((o, Rule::EvenOdd));
        }
    }
    let area = stroke_outline(&shape, &props)?;
    let rule = if props.dashes.is_empty() && props.closed && align != Align::Center { Rule::EvenOdd } else { Rule::NonZero };
    Ok((area, rule))
}

#[cfg(test)]
mod tests {
    use super::*;
    use kurbo::Point;

    fn rect_cmds(w: f64, h: f64, r: f64) -> Vec<Cmd> {
        vec![Cmd::R { w, h, radii: [r; 4] }]
    }

    /// The area `path` paints under `rule`, by sampling its winding at cell centres.
    fn area(path: &BezPath, rule: Rule) -> f64 {
        let b = path.bounding_box();
        let step = 0.25;
        let (nx, ny) = (((b.width() / step).ceil() as i32).max(1), ((b.height() / step).ceil() as i32).max(1));
        let mut hits = 0u64;
        for i in 0..nx {
            for j in 0..ny {
                let wn = path.winding(Point::new(b.x0 + (i as f64 + 0.5) * step, b.y0 + (j as f64 + 0.5) * step));
                if match rule {
                    Rule::EvenOdd => wn % 2 != 0,
                    Rule::NonZero => wn != 0,
                } {
                    hits += 1;
                }
            }
        }
        hits as f64 * step * step
    }

    fn props(weight: f64, align: Align) -> StrokeProps {
        StrokeProps { weight, align, join: StrokeJoin::Miter, ..StrokeProps::default() }
    }

    fn close(a: f64, b: f64, tol: f64) {
        assert!((a - b).abs() <= tol, "{a} vs {b} (tolerance {tol})");
    }

    #[test]
    fn rectangle_inside_center_outside_bounds_and_area() {
        let cmds = rect_cmds(100.0, 100.0, 0.0);
        let (p, rule) = stroke_area(&cmds, &props(10.0, Align::Inside)).unwrap();
        let b = p.bounding_box();
        close(b.x0, 0.0, 0.01);
        close(b.x1, 100.0, 0.01);
        close(area(&p, rule), 100.0 * 100.0 - 80.0 * 80.0, 20.0);
        let (p, rule) = stroke_area(&cmds, &props(10.0, Align::Center)).unwrap();
        let b = p.bounding_box();
        close(b.x0, -5.0, 0.01);
        close(b.x1, 105.0, 0.01);
        close(area(&p, rule), 110.0 * 110.0 - 90.0 * 90.0, 20.0);
        let (p, rule) = stroke_area(&cmds, &props(10.0, Align::Outside)).unwrap();
        let b = p.bounding_box();
        close(b.x0, -10.0, 0.01);
        close(b.x1, 110.0, 0.01);
        close(area(&p, rule), 120.0 * 120.0 - 100.0 * 100.0, 20.0);
    }

    #[test]
    fn a_rounded_rectangle_ring_follows_its_corner_radius() {
        let (p, rule) = stroke_area(&rect_cmds(100.0, 100.0, 20.0), &props(4.0, Align::Inside)).unwrap();
        let outer = 10_000.0 - (4.0 - std::f64::consts::PI) * 400.0;
        let inner = 92.0 * 92.0 - (4.0 - std::f64::consts::PI) * 256.0;
        close(area(&p, rule), outer - inner, 15.0);
        assert_eq!(rule, Rule::EvenOdd);
    }

    #[test]
    fn the_ring_and_the_general_route_agree() {
        // A rectangle drawn as plain lines takes the boolean route: same area as the ring shortcut.
        let lines: Vec<Cmd> = vec![
            Cmd::M { x: 0.0, y: 0.0 },
            Cmd::L { x: 100.0, y: 0.0 },
            Cmd::L { x: 100.0, y: 60.0 },
            Cmd::L { x: 0.0, y: 60.0 },
            Cmd::Z,
        ];
        for align in [Align::Inside, Align::Outside] {
            let (a, ra) = stroke_area(&lines, &props(6.0, align)).unwrap();
            let (b, rb) = stroke_area(&rect_cmds(100.0, 60.0, 0.0), &props(6.0, align)).unwrap();
            close(area(&a, ra), area(&b, rb), 12.0);
            let (ba, bb) = (a.bounding_box(), b.bounding_box());
            close(ba.x0, bb.x0, 0.05);
            close(ba.y1, bb.y1, 0.05);
        }
    }

    #[test]
    fn a_circle_ring_and_an_ellipse_stay_in_their_alignment() {
        let circle = [Cmd::E { cx: 50.0, cy: 50.0, rx: 50.0, ry: 50.0, start: 0.0, end: std::f64::consts::TAU, ccw: false }];
        let (p, rule) = stroke_area(&circle, &props(10.0, Align::Inside)).unwrap();
        let b = p.bounding_box();
        close(b.x0, 0.0, 0.1);
        close(area(&p, rule), std::f64::consts::PI * (2500.0 - 1600.0), 20.0);
        let ellipse = [Cmd::E { cx: 60.0, cy: 30.0, rx: 60.0, ry: 30.0, start: 0.0, end: std::f64::consts::TAU, ccw: false }];
        let (p, _) = stroke_area(&ellipse, &props(8.0, Align::Outside)).unwrap();
        let b = p.bounding_box();
        close(b.x0, -8.0, 0.2);
        close(b.y1, 68.0, 0.2);
    }

    #[test]
    fn an_open_path_is_always_centred() {
        let line = [Cmd::M { x: 0.0, y: 0.0 }, Cmd::L { x: 100.0, y: 0.0 }];
        let p = StrokeProps { weight: 10.0, align: Align::Inside, cap: StrokeCap::Butt, closed: false, ..StrokeProps::default() };
        let (a, rule) = stroke_area(&line, &p).unwrap();
        let b = a.bounding_box();
        close(b.y0, -5.0, 0.01);
        close(b.y1, 5.0, 0.01);
        close(b.x1, 100.0, 0.01);
        close(area(&a, rule), 1000.0, 5.0);
        assert_eq!(rule, Rule::NonZero);
    }

    #[test]
    fn caps_and_joins_change_the_outline() {
        let line = [Cmd::M { x: 0.0, y: 0.0 }, Cmd::L { x: 100.0, y: 0.0 }];
        let base = StrokeProps { weight: 10.0, closed: false, ..StrokeProps::default() };
        let bounds = |cap| stroke_area(&line, &StrokeProps { cap, ..base.clone() }).unwrap().0.bounding_box();
        close(bounds(StrokeCap::Butt).x0, 0.0, 0.01);
        close(bounds(StrokeCap::Square).x0, -5.0, 0.01);
        close(bounds(StrokeCap::Round).x0, -5.0, 0.05);
        // A right-angle corner: the miter fills the outer corner, the bevel cuts it, the round join sits between.
        let bend = [Cmd::M { x: 0.0, y: 0.0 }, Cmd::L { x: 50.0, y: 0.0 }, Cmd::L { x: 50.0, y: 50.0 }];
        let filled = |join| {
            let (a, rule) = stroke_area(&bend, &StrokeProps { join, cap: StrokeCap::Butt, ..base.clone() }).unwrap();
            area(&a, rule)
        };
        let (miter, round, bevel) = (filled(StrokeJoin::Miter), filled(StrokeJoin::Round), filled(StrokeJoin::Bevel));
        close(miter - bevel, 12.5, 1.0);
        assert!(round > bevel && round < miter);
    }

    #[test]
    fn dashes_on_an_open_line() {
        let line = [Cmd::M { x: 0.0, y: 0.0 }, Cmd::L { x: 100.0, y: 0.0 }];
        let p = StrokeProps { weight: 2.0, dashes: vec![10.0, 10.0], cap: StrokeCap::Butt, closed: false, ..StrokeProps::default() };
        let (a, rule) = stroke_area(&line, &p).unwrap();
        close(area(&a, rule), 100.0, 2.0);
        assert_eq!(geom::split_subpaths(&a).len(), 5);
        // A pattern too fine for its path draws solid.
        let fine = StrokeProps { dashes: vec![0.01, 0.01], ..p };
        let long = [Cmd::M { x: 0.0, y: 0.0 }, Cmd::L { x: 10_000.0, y: 0.0 }];
        let (a, _) = stroke_area(&long, &fine).unwrap();
        assert!(a.elements().len() < 100);
    }

    #[test]
    fn a_dashed_closed_stroke_stays_inside() {
        let p = StrokeProps { dashes: vec![8.0, 4.0], ..props(6.0, Align::Inside) };
        let (a, _) = stroke_area(&rect_cmds(80.0, 80.0, 0.0), &p).unwrap();
        let b = a.bounding_box();
        assert!(b.x0 >= -0.01 && b.x1 <= 80.01 && b.y0 >= -0.01 && b.y1 <= 80.01, "{b:?}");
        assert!(area(&a, Rule::NonZero) > 100.0);
    }

    #[test]
    fn per_side_strokes_sit_on_their_sides() {
        let cmds = rect_cmds(100.0, 100.0, 0.0);
        let mut p = props(10.0, Align::Inside);
        p.sides = Some([10.0, 0.0, 0.0, 0.0]);
        let covers = |a: &BezPath, rule: Rule, x: f64, y: f64| {
            let w = a.winding(Point::new(x, y));
            match rule {
                Rule::EvenOdd => w % 2 != 0,
                Rule::NonZero => w != 0,
            }
        };
        // Inside: the top band only, 100 wide and 10 tall (the ring's shared edges cancel under even-odd).
        let (a, rule) = stroke_area(&cmds, &p).unwrap();
        close(area(&a, rule), 1000.0, 2.0);
        assert!(covers(&a, rule, 50.0, 5.0) && !covers(&a, rule, 50.0, 15.0) && !covers(&a, rule, 5.0, 50.0));
        p.align = Align::Outside;
        let (a, rule) = stroke_area(&cmds, &p).unwrap();
        close(area(&a, rule), 1000.0, 2.0);
        assert!(covers(&a, rule, 50.0, -5.0) && !covers(&a, rule, 50.0, 5.0));
        p.align = Align::Center;
        let (a, rule) = stroke_area(&cmds, &p).unwrap();
        close(area(&a, rule), 1000.0, 2.0);
        assert!(covers(&a, rule, 50.0, -4.0) && covers(&a, rule, 50.0, 4.0) && !covers(&a, rule, 50.0, 6.0));
        // Unequal sides on a rounded box: a CSS-like ring.
        let mut p = props(0.0, Align::Inside);
        p.sides = Some([6.0, 2.0, 6.0, 2.0]);
        let (a, rule) = stroke_area(&rect_cmds(100.0, 60.0, 12.0), &p).unwrap();
        assert!(area(&a, rule) > 900.0);
        assert!(a.bounding_box().x0 >= -0.01);
    }

    #[test]
    fn equal_sides_are_the_uniform_stroke() {
        let cmds = rect_cmds(100.0, 100.0, 0.0);
        let mut p = props(0.0, Align::Inside);
        p.sides = Some([10.0; 4]);
        let (a, ra) = stroke_area(&cmds, &p).unwrap();
        let (b, rb) = stroke_area(&cmds, &props(10.0, Align::Inside)).unwrap();
        close(area(&a, ra), area(&b, rb), 1.0);
    }

    /// A glyph-like outline: an outer ring and a hole running the other way (non-zero reads the hole as a counter).
    fn glyph_o() -> Vec<Cmd> {
        let sq = |x0: f64, y0: f64, x1: f64, y1: f64, rev: bool| {
            let pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)];
            let order: Vec<(f64, f64)> = if rev { pts.iter().rev().copied().collect() } else { pts.to_vec() };
            let mut v = vec![Cmd::M { x: order[0].0, y: order[0].1 }];
            v.extend(order[1..].iter().map(|(x, y)| Cmd::L { x: *x, y: *y }));
            v.push(Cmd::Z);
            v
        };
        [sq(0.0, 0.0, 100.0, 100.0, false), sq(30.0, 30.0, 70.0, 70.0, true)].concat()
    }

    #[test]
    fn a_text_outline_keeps_its_counter() {
        let o = glyph_o();
        let hit = |p: &BezPath, rule: Rule, x: f64, y: f64| {
            let w = p.winding(Point::new(x, y));
            match rule {
                Rule::EvenOdd => w % 2 != 0,
                Rule::NonZero => w != 0,
            }
        };
        // Material is 0..30 and 70..100; the counter 30..70 stays empty, and the stroke stays in the material.
        let (inside, rule) = stroke_area(&o, &props(4.0, Align::Inside)).unwrap();
        assert!(hit(&inside, rule, 2.0, 50.0), "outer edge band");
        assert!(hit(&inside, rule, 28.0, 50.0), "band against the counter's edge");
        assert!(!hit(&inside, rule, 31.0, 50.0), "the counter is not stroked");
        assert!(!hit(&inside, rule, 15.0, 50.0), "the middle of the material is empty");
        let (outside, rule) = stroke_area(&o, &props(4.0, Align::Outside)).unwrap();
        assert!(hit(&outside, rule, 102.0, 50.0));
        assert!(hit(&outside, rule, 32.0, 50.0), "outside the glyph includes the counter's edge");
        assert!(!hit(&outside, rule, 98.0, 50.0));
        close(outside.bounding_box().x0, -4.0, 0.1);
    }

    #[test]
    fn hostile_input_is_refused_or_empty() {
        let bad = [Cmd::M { x: f64::NAN, y: 0.0 }, Cmd::L { x: 1.0, y: 1.0 }];
        assert_eq!(stroke_area(&bad, &StrokeProps::default()).unwrap_err(), StrokeError::BadInput);
        let r = rect_cmds(10.0, 10.0, 0.0);
        assert!(stroke_area(&r, &StrokeProps { weight: 0.0, ..StrokeProps::default() }).unwrap().0.elements().is_empty());
        assert!(stroke_area(&r, &StrokeProps { weight: f64::INFINITY, ..StrokeProps::default() }).unwrap().0.elements().is_empty());
        assert!(stroke_area(&[], &StrokeProps::default()).unwrap().0.elements().is_empty());
        let _ = stroke_area(&r, &StrokeProps { weight: 1e300, align: Align::Inside, ..StrokeProps::default() });
    }

    #[test]
    fn props_parse_from_the_node_fields() {
        let p: StrokeProps = serde_json::from_str(r#"{"weight":3,"align":"outside","join":"bevel","cap":"none","miterLimit":2,"dashes":[4,2],"sides":[1,2,3,4],"closed":false}"#).unwrap();
        assert_eq!((p.weight, p.align, p.join, p.cap, p.closed), (3.0, Align::Outside, StrokeJoin::Bevel, StrokeCap::Butt, false));
        assert_eq!(p.sides, Some([1.0, 2.0, 3.0, 4.0]));
        let d: StrokeProps = serde_json::from_str("{}").unwrap();
        assert_eq!((d.join, d.cap, d.align), (StrokeJoin::Round, StrokeCap::Round, Align::Center));
    }
}
