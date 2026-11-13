//! The paint model and its SVG paint servers.
//!
//! A paint is one entry of a layer's fill list or its stroke: solid, the four gradients, a pattern, an image or a video, each with
//! an opacity, a visibility and a blend mode. The model follows FigCraft's `Paint` / `PaintKind` (`figcraft_color`), MIT OR Apache-2.0,
//! Copyright (c) 2026 ArtCraft Team and the FigCraft contributors, and reads and writes the JSON shape Midas stores
//! (`geometry/fills.js`), so a fill goes across the bridge as it is. Video is Midas's own (FigCraft has none).
//! See THIRD_PARTY_NOTICES.

use crate::geom::num;
use serde::{Deserialize, Serialize};

/// An sRGB colour with alpha, read from and written as hex (`#rrggbb`, `#rrggbbaa`, `#rgb`; `none` is clear).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Color {
    pub fn parse(s: &str) -> Option<Color> {
        let s = s.trim();
        if s.eq_ignore_ascii_case("none") {
            return Some(Color { r: 0, g: 0, b: 0, a: 0 });
        }
        let h = s.strip_prefix('#')?;
        let byte = |i: usize| u8::from_str_radix(h.get(i..i + 2)?, 16).ok();
        let nib = |i: usize| u8::from_str_radix(h.get(i..i + 1)?, 16).ok().map(|v| v * 17);
        match h.len() {
            3 => Some(Color { r: nib(0)?, g: nib(1)?, b: nib(2)?, a: 255 }),
            6 => Some(Color { r: byte(0)?, g: byte(2)?, b: byte(4)?, a: 255 }),
            8 => Some(Color { r: byte(0)?, g: byte(2)?, b: byte(4)?, a: byte(6)? }),
            _ => None,
        }
    }

    /// `#rrggbb`, the colour without its alpha.
    pub fn hex6(&self) -> String {
        format!("#{:02x}{:02x}{:02x}", self.r, self.g, self.b)
    }

    /// `#rrggbb`, or `#rrggbbaa` when not opaque.
    pub fn hex(&self) -> String {
        if self.a == 255 { self.hex6() } else { format!("{}{:02x}", self.hex6(), self.a) }
    }

    fn alpha(&self) -> f64 {
        f64::from(self.a) / 255.0
    }
}

impl Serialize for Color {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.hex())
    }
}

impl<'de> Deserialize<'de> for Color {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        Color::parse(&s).ok_or_else(|| serde::de::Error::custom(format!("not a hex colour: {s}")))
    }
}

/// How a paint composites with what is behind it (the canvas composite operations).
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum BlendMode {
    #[default]
    Normal,
    Darken,
    Multiply,
    ColorBurn,
    Lighten,
    Screen,
    ColorDodge,
    Overlay,
    SoftLight,
    HardLight,
    Difference,
    Exclusion,
    Hue,
    Saturation,
    Color,
    Luminosity,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
pub struct Pt {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Handles {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub a: Option<Pt>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub b: Option<Pt>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub c: Option<Pt>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Stop {
    pub pos: f64,
    pub color: Color,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alpha: Option<f64>,
}

/// A gradient's fields (the four kinds share them): stops, the two end colours, a linear angle and the handle points.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Gradient {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub stops: Vec<Stop>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<Color>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color2: Option<Color>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub angle: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handles: Option<Handles>,
}

impl Gradient {
    /// The stops, sorted: the stops it holds, else its two colours; the first and last follow `color` and `color2`.
    pub fn sorted_stops(&self) -> Vec<Stop> {
        let grey = Color { r: 0xd9, g: 0xd9, b: 0xd9, a: 255 };
        let white = Color { r: 255, g: 255, b: 255, a: 255 };
        let mut stops = if self.stops.len() >= 2 {
            self.stops.clone()
        } else {
            vec![Stop { pos: 0.0, color: self.color.unwrap_or(grey), alpha: None }, Stop { pos: 1.0, color: self.color2.unwrap_or(white), alpha: None }]
        };
        stops.sort_by(|a, b| a.pos.total_cmp(&b.pos));
        if let (Some(c), Some(first)) = (self.color, stops.first_mut()) {
            first.color = c;
        }
        if let (Some(c), Some(last)) = (self.color2, stops.last_mut()) {
            last.color = c;
        }
        stops
    }

    /// The handle points in unit space. A linear one runs a to b (along its angle across the box when it holds no handles); a radial one
    /// centres on a with b ending its x axis and c its y axis.
    pub fn handle_points(&self, linear: bool, w: f64, h: f64) -> (Pt, Pt, Option<Pt>) {
        let hd = self.handles.clone().unwrap_or_default();
        if linear && self.handles.is_none() && w > 0.0 && h > 0.0 {
            let r = self.angle.unwrap_or(90.0).to_radians();
            let (c, s) = (r.cos(), r.sin());
            let len = (w * c).abs() + (h * s).abs();
            let (dx, dy) = (c * len / 2.0 / w, s * len / 2.0 / h);
            return (Pt { x: 0.5 - dx, y: 0.5 - dy }, Pt { x: 0.5 + dx, y: 0.5 + dy }, None);
        }
        if linear {
            return (hd.a.unwrap_or(Pt { x: 0.0, y: 0.5 }), hd.b.unwrap_or(Pt { x: 1.0, y: 0.5 }), None);
        }
        (hd.a.unwrap_or(Pt { x: 0.5, y: 0.5 }), hd.b.unwrap_or(Pt { x: 1.0, y: 0.5 }), Some(hd.c.unwrap_or(Pt { x: 0.5, y: 1.0 })))
    }
}

/// Image adjustments, each -1..1.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Adjust {
    #[serde(default, skip_serializing_if = "is_zero")]
    pub exposure: f64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub contrast: f64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub saturation: f64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub temperature: f64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub tint: f64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub highlights: f64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub shadows: f64,
}

fn is_zero(v: &f64) -> bool {
    *v == 0.0
}

/// A crop window: where the picture is anchored (0..1) and its zoom.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Crop {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scale: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rotation: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Solid {
    pub color: Color,
}

/// A picture: an asset id, how it fills the box, and its natural size once measured.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Image {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub image: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scale: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rotation: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub crop: Option<Crop>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adjust: Option<Adjust>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iw: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ih: Option<f64>,
}

/// A video (Midas only): its asset, a poster, how it fills the box and its playback settings.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Video {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub poster: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scale: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rotation: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub crop: Option<Crop>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adjust: Option<Adjust>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iw: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ih: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autoplay: Option<bool>,
    #[serde(rename = "loop", skip_serializing_if = "Option::is_none")]
    pub looped: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sound: Option<bool>,
}

/// A pattern: a source layer's picture repeated, with a tile type, scale, spacing (percent of the tile) and alignment.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Pattern {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(rename = "tileType", skip_serializing_if = "Option::is_none")]
    pub tile_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scale: Option<f64>,
    #[serde(rename = "spacingX", skip_serializing_if = "Option::is_none")]
    pub spacing_x: Option<f64>,
    #[serde(rename = "spacingY", skip_serializing_if = "Option::is_none")]
    pub spacing_y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iw: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ih: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PaintKind {
    Solid(Solid),
    Linear(Gradient),
    Radial(Gradient),
    Angular(Gradient),
    Diamond(Gradient),
    Pattern(Pattern),
    Image(Image),
    Video(Video),
}

/// One paint of a fill list or a stroke.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Paint {
    #[serde(flatten)]
    pub kind: PaintKind,
    #[serde(default = "one")]
    pub opacity: f64,
    #[serde(default = "yes")]
    pub visible: bool,
    #[serde(default, skip_serializing_if = "is_normal")]
    pub blend: BlendMode,
}

fn one() -> f64 {
    1.0
}
fn yes() -> bool {
    true
}
fn is_normal(b: &BlendMode) -> bool {
    *b == BlendMode::Normal
}

/// A gradient or a pattern as SVG `defs` and the value of the `fill` attribute that reads them (`flat`: a plain colour standing in for a paint SVG cannot draw).
#[derive(Clone, Debug, Default, PartialEq)]
struct PaintServer {
    defs: String,
    paint: String,
    flat: bool,
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('"', "&quot;").replace('<', "&lt;")
}

/// The image adjustments as SVG filter primitives (the same mapping as the CSS filter of `imageAdjustFilter`: exposure and highlights
/// and shadows are brightness, contrast and saturation their own, temperature a sepia and a hue shift, tint a hue shift).
pub fn adjust_primitives(a: &Adjust) -> Option<String> {
    let mut out = String::new();
    let brightness = |out: &mut String, v: f64| {
        let v = num(v);
        out.push_str(&format!("<feComponentTransfer><feFuncR type=\"linear\" slope=\"{v}\"/><feFuncG type=\"linear\" slope=\"{v}\"/><feFuncB type=\"linear\" slope=\"{v}\"/></feComponentTransfer>"));
    };
    if a.exposure != 0.0 {
        brightness(&mut out, 1.0 + a.exposure.abs().min(1.0) * a.exposure.signum());
    }
    if a.contrast != 0.0 {
        let v = 1.0 + a.contrast;
        let (s, i) = (num(v), num((1.0 - v) / 2.0));
        out.push_str(&format!("<feComponentTransfer><feFuncR type=\"linear\" slope=\"{s}\" intercept=\"{i}\"/><feFuncG type=\"linear\" slope=\"{s}\" intercept=\"{i}\"/><feFuncB type=\"linear\" slope=\"{s}\" intercept=\"{i}\"/></feComponentTransfer>"));
    }
    if a.saturation != 0.0 {
        out.push_str(&format!("<feColorMatrix type=\"saturate\" values=\"{}\"/>", num((1.0 + a.saturation).max(0.0))));
    }
    if a.temperature != 0.0 {
        let k = 1.0 - (a.temperature.abs() * 0.35).min(0.35);
        let m = [
            0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0.0, 0.0,
            0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0.0, 0.0,
            0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k, 0.0, 0.0,
            0.0, 0.0, 0.0, 1.0, 0.0,
        ];
        out.push_str(&format!("<feColorMatrix type=\"matrix\" values=\"{}\"/>", m.iter().map(|v| num(*v)).collect::<Vec<_>>().join(" ")));
        out.push_str(&format!("<feColorMatrix type=\"hueRotate\" values=\"{}\"/>", num(a.temperature * 15.0)));
    } else if a.tint != 0.0 {
        out.push_str(&format!("<feColorMatrix type=\"hueRotate\" values=\"{}\"/>", num(a.tint * 20.0)));
    }
    if a.highlights != 0.0 {
        brightness(&mut out, 1.0 + a.highlights * 0.3);
    }
    if a.shadows != 0.0 {
        brightness(&mut out, 1.0 + a.shadows * 0.2);
    }
    if out.is_empty() { None } else { Some(out) }
}

fn filter_def(id: &str, a: Option<&Adjust>) -> Option<(String, String)> {
    let prims = adjust_primitives(a?)?;
    let fid = format!("{id}f");
    Some((format!("<filter id=\"{fid}\" color-interpolation-filters=\"sRGB\">{prims}</filter>"), format!(" filter=\"url(#{fid})\"")))
}

fn gradient_server(kind: &PaintKind, g: &Gradient, id: &str, w: f64, h: f64) -> PaintServer {
    let stops = g.sorted_stops();
    let linear = matches!(kind, PaintKind::Linear(_));
    if !linear && !matches!(kind, PaintKind::Radial(_)) {
        // An angular gradient is a conic one and a diamond is neither linear nor radial: SVG has no paint server for them, so the
        // paint is the first stop's colour. They are never written as a radialGradient.
        return PaintServer { defs: String::new(), paint: stops[0].color.hex6(), flat: true };
    }
    let list: String = stops
        .iter()
        .map(|s| {
            let op = s.alpha.unwrap_or(1.0) * s.color.alpha();
            format!("<stop offset=\"{}\" stop-color=\"{}\"{}/>", num(s.pos), s.color.hex6(), if op < 1.0 { format!(" stop-opacity=\"{}\"", num(op)) } else { String::new() })
        })
        .collect();
    let (a, b, c) = g.handle_points(linear, w, h);
    // The handles are in the layer's unit box; the server is in the layer's pixel space so a stroke area larger than the box still lines up.
    if linear {
        let defs = format!("<linearGradient id=\"{id}\" gradientUnits=\"userSpaceOnUse\" x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\">{list}</linearGradient>", num(a.x * w), num(a.y * h), num(b.x * w), num(b.y * h));
        return PaintServer { defs, paint: format!("url(#{id})"), flat: false };
    }
    let c = c.unwrap_or(Pt { x: a.x, y: a.y + 0.5 });
    let m = [(b.x - a.x) * w, (b.y - a.y) * h, (c.x - a.x) * w, (c.y - a.y) * h, a.x * w, a.y * h].map(num).join(" ");
    PaintServer { defs: format!("<radialGradient id=\"{id}\" gradientUnits=\"userSpaceOnUse\" cx=\"0\" cy=\"0\" r=\"1\" gradientTransform=\"matrix({m})\">{list}</radialGradient>"), paint: format!("url(#{id})"), flat: false }
}

/// The repeating cell of a tile type: `[(width, height, offsets)]`. RECTANGULAR is one tile, HORIZONTAL_HEXAGONAL shifts every other row by
/// half a step, VERTICAL_HEXAGONAL every other column.
fn pattern_cell(tile_type: Option<&str>, sx: f64, sy: f64) -> (f64, f64, Vec<(f64, f64)>) {
    match tile_type {
        Some("HORIZONTAL_HEXAGONAL") => (sx, sy * 2.0, vec![(0.0, 0.0), (sx / 2.0, sy)]),
        Some("VERTICAL_HEXAGONAL") => (sx * 2.0, sy, vec![(0.0, 0.0), (sx, sy / 2.0)]),
        _ => (sx, sy, vec![(0.0, 0.0)]),
    }
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

fn pattern_server(p: &Pattern, id: &str, w: f64, h: f64, src: Option<&str>) -> Option<PaintServer> {
    let (iw, ih) = (p.iw.filter(|v| *v > 0.0)?, p.ih.filter(|v| *v > 0.0)?);
    let src = src?;
    let s = p.scale.unwrap_or(1.0);
    let (tw, th) = (iw * s, ih * s);
    let step = (round2(tw * (1.0 + p.spacing_x.unwrap_or(0.0) / 100.0)), round2(th * (1.0 + p.spacing_y.unwrap_or(0.0) / 100.0)));
    let (cw, ch, at) = pattern_cell(p.tile_type.as_deref(), step.0, step.1);
    // Where the grid starts in the box: the leftover of the box over whole steps, by the 9-point alignment.
    let align = p.align.as_deref().unwrap_or("top-left");
    let has = |w: &str| align.split('-').any(|x| x == w);
    let hx = if has("left") { 0.0 } else if has("right") { 1.0 } else { 0.5 };
    let hy = if has("top") { 0.0 } else if has("bottom") { 1.0 } else { 0.5 };
    let left = (w - (w / step.0).floor() * step.0).max(0.0);
    let top = (h - (h / step.1).floor() * step.1).max(0.0);
    let images: String = at.iter().map(|(x, y)| format!("<image href=\"{}\" x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\"/>", esc(src), num(*x), num(*y), num(tw), num(th))).collect();
    Some(PaintServer {
        defs: format!("<pattern id=\"{id}\" patternUnits=\"userSpaceOnUse\" x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\">{images}</pattern>", num(round2(left * hx)), num(round2(top * hy)), num(cw), num(ch)),
        paint: format!("url(#{id})"),
        flat: false,
    })
}

/// Where a picture is drawn in a box: the rectangle the picture covers, in the box's own space (it may reach beyond the box on one axis), and its turn about
/// the box's centre. A tiled picture is one tile at the origin that repeats. The one place the canvas and Play take a picture's placement from.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Extent {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub tile: bool,
    pub rotation: f64,
}

/// The extent of a picture of `natural` size (`iw`, `ih`) in a box `w` by `h`: `fill` covers the box (cropped on one axis), `fit` is contained in it, `crop` covers
/// by the crop's zoom around its anchor (0..1, the centre by default), and `tile` is the picture at its natural size times `scale`, repeating. None while the box or the
/// natural size is not a positive size (a picture not measured yet is not drawn).
pub fn picture_extent(mode: Option<&str>, w: f64, h: f64, natural: (f64, f64), scale: Option<f64>, crop: Option<&Crop>, rotation: Option<f64>) -> Option<Extent> {
    let (iw, ih) = natural;
    if !(w > 0.0 && h > 0.0 && iw > 0.0 && ih > 0.0) {
        return None;
    }
    let rotation = rotation.or(crop.and_then(|c| c.rotation)).unwrap_or(0.0);
    let centred = |k: f64| Extent { x: (w - iw * k) / 2.0, y: (h - ih * k) / 2.0, w: iw * k, h: ih * k, tile: false, rotation };
    Some(match mode.unwrap_or("fill") {
        "tile" => {
            let s = scale.unwrap_or(1.0);
            Extent { x: 0.0, y: 0.0, w: iw * s, h: ih * s, tile: true, rotation }
        }
        "fit" => centred((w / iw).min(h / ih)),
        "crop" => {
            let c = crop.cloned().unwrap_or_default();
            let (zoom, cx, cy) = (c.scale.unwrap_or(1.0), c.x.unwrap_or(0.5), c.y.unwrap_or(0.5));
            let k = (w / iw).max(h / ih) * zoom;
            let (dw, dh) = (iw * k, ih * k);
            Extent { x: (w - dw) / 2.0 - (cx - 0.5) * dw, y: (h - dh) / 2.0 - (cy - 0.5) * dh, w: dw, h: dh, tile: false, rotation }
        }
        _ => centred((w / iw).max(h / ih)),
    })
}

/// A stroke paint as SVG: `defs` (a gradient, a pattern, a filter) and `content`, the markup that paints it. The caller places `content` in a group clipped by
/// the stroke's area path, so whatever the paint is, only the stroke shows it.
#[derive(Clone, Debug, Default, Serialize, PartialEq)]
pub struct PaintLayer {
    pub defs: String,
    pub content: String,
    /// The content is a plain colour standing in for a paint SVG cannot draw (an angular or a diamond gradient).
    pub flat: bool,
}

/// A rectangle larger than any layer, filled with a paint that extends (a gradient pads, a pattern repeats): the clip decides what shows.
const FIELD: &str = r#"x="-100000" y="-100000" width="200000" height="200000""#;

fn field(fill: &str) -> String {
    format!("<rect {FIELD} fill=\"{fill}\"/>")
}

#[allow(clippy::too_many_arguments)]
fn picture_layer(src: Option<&str>, mode: Option<&str>, scale: Option<f64>, rotation: Option<f64>, crop: Option<&Crop>, adjust: Option<&Adjust>, natural: (Option<f64>, Option<f64>), id: &str, w: f64, h: f64) -> Option<PaintLayer> {
    let src = src?;
    let ext = picture_extent(mode, w, h, (natural.0?, natural.1?), scale, crop, rotation)?;
    let (fdef, fattr) = filter_def(id, adjust).unwrap_or_default();
    let href = esc(src);
    if ext.tile {
        let turn = if ext.rotation != 0.0 { format!(" patternTransform=\"rotate({} {} {})\"", num(ext.rotation), num(w / 2.0), num(h / 2.0)) } else { String::new() };
        return Some(PaintLayer {
            defs: format!("{fdef}<pattern id=\"{id}\" patternUnits=\"userSpaceOnUse\" width=\"{}\" height=\"{}\"{turn}><image href=\"{href}\" width=\"{}\" height=\"{}\"{fattr}/></pattern>", num(ext.w), num(ext.h), num(ext.w), num(ext.h)),
            content: field(&format!("url(#{id})")),
            flat: false,
        });
    }
    let turn = if ext.rotation != 0.0 { format!(" transform=\"rotate({} {} {})\"", num(ext.rotation), num(w / 2.0), num(h / 2.0)) } else { String::new() };
    Some(PaintLayer {
        defs: fdef,
        content: format!("<image href=\"{href}\" x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" preserveAspectRatio=\"none\"{turn}{fattr}/>", num(ext.x), num(ext.y), num(ext.w), num(ext.h)),
        flat: false,
    })
}

impl Paint {
    /// The extent of this picture paint (an image, or a video's poster) in a box `w` by `h`. `natural` is the picture's size when the caller has measured it
    /// (the canvas has the loaded image); otherwise the paint's own recorded size. None for any other paint.
    pub fn extent(&self, w: f64, h: f64, natural: Option<(f64, f64)>) -> Option<Extent> {
        match &self.kind {
            PaintKind::Image(i) => picture_extent(i.mode.as_deref(), w, h, natural.or(i.iw.zip(i.ih))?, i.scale, i.crop.as_ref(), i.rotation),
            PaintKind::Video(v) => picture_extent(v.mode.as_deref(), w, h, natural.or(v.iw.zip(v.ih))?, v.scale, v.crop.as_ref(), v.rotation),
            _ => None,
        }
    }

    /// The SVG layer of a stroke paint for a layer `w` by `h`. `src` is the asset the paint draws (an image, a video's poster, a pattern's tile): the caller resolves it
    /// from its asset table. None for a solid paint (a solid stroke is attributes), a hidden paint, or one that cannot be drawn yet (no asset, or no measured size
    /// where it needs one).
    pub fn layer(&self, id: &str, w: f64, h: f64, src: Option<&str>) -> Option<PaintLayer> {
        if !self.visible {
            return None;
        }
        match &self.kind {
            PaintKind::Solid(_) => None,
            PaintKind::Linear(g) | PaintKind::Radial(g) | PaintKind::Angular(g) | PaintKind::Diamond(g) => {
                let s = gradient_server(&self.kind, g, id, w, h);
                Some(PaintLayer { defs: s.defs, content: field(&s.paint), flat: s.flat })
            }
            PaintKind::Pattern(p) => {
                let s = pattern_server(p, id, w, h, src)?;
                Some(PaintLayer { defs: s.defs, content: field(&s.paint), flat: false })
            }
            PaintKind::Image(i) => picture_layer(src, i.mode.as_deref(), i.scale, i.rotation, i.crop.as_ref(), i.adjust.as_ref(), (i.iw, i.ih), id, w, h),
            PaintKind::Video(v) => picture_layer(src, v.mode.as_deref(), v.scale, v.rotation, v.crop.as_ref(), v.adjust.as_ref(), (v.iw, v.ih), id, w, h),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    fn paint(v: Value) -> Paint {
        serde_json::from_value(v).unwrap()
    }

    fn close(a: f64, b: f64) {
        assert!((a - b).abs() < 1e-9, "{a} vs {b}");
    }

    #[test]
    fn colours_parse_and_write_hex() {
        assert_eq!(Color::parse("#ff8000").unwrap().hex(), "#ff8000");
        assert_eq!(Color::parse("#f80").unwrap().hex(), "#ff8800");
        assert_eq!(Color::parse("#11223380").unwrap().hex(), "#11223380");
        assert_eq!(Color::parse("none").unwrap().a, 0);
        assert!(Color::parse("rgba(1,2,3,.5)").is_none());
        assert!(Color::parse("#12345").is_none());
    }

    #[test]
    fn every_kind_round_trips_through_json() {
        let fills = [
            json!({"type": "solid", "color": "#336699", "opacity": 0.5, "visible": true}),
            json!({"type": "solid", "color": "#33669980", "opacity": 1.0, "visible": false, "blend": "multiply"}),
            json!({"type": "linear", "angle": 45.0, "stops": [{"pos": 0.0, "color": "#ff0000"}, {"pos": 1.0, "color": "#0000ff", "alpha": 0.5}], "opacity": 1.0, "visible": true}),
            json!({"type": "radial", "handles": {"a": {"x": 0.5, "y": 0.5}, "b": {"x": 1.0, "y": 0.5}, "c": {"x": 0.5, "y": 1.0}}, "color": "#111111", "color2": "#eeeeee", "opacity": 1.0, "visible": true}),
            json!({"type": "angular", "stops": [{"pos": 0.0, "color": "#ff0000"}, {"pos": 1.0, "color": "#00ff00"}], "opacity": 0.8, "visible": true, "blend": "overlay"}),
            json!({"type": "diamond", "stops": [{"pos": 0.0, "color": "#ff0000"}, {"pos": 1.0, "color": "#00ff00"}], "opacity": 1.0, "visible": true}),
            json!({"type": "pattern", "source": "n1", "tileType": "HORIZONTAL_HEXAGONAL", "scale": 2.0, "spacingX": 10.0, "spacingY": 5.0, "align": "center", "iw": 16.0, "ih": 16.0, "opacity": 1.0, "visible": true}),
            json!({"type": "image", "image": "asset-1", "mode": "crop", "crop": {"x": 0.25, "y": 0.75, "scale": 1.5}, "rotation": 90.0, "adjust": {"exposure": 0.2, "contrast": -0.1}, "iw": 640.0, "ih": 480.0, "opacity": 1.0, "visible": true}),
            json!({"type": "video", "video": "asset-2", "poster": "asset-3", "mode": "fill", "autoplay": true, "loop": false, "sound": false, "opacity": 1.0, "visible": true}),
        ];
        for f in fills {
            let p = paint(f.clone());
            assert_eq!(serde_json::to_value(&p).unwrap(), f, "{f}");
        }
    }

    #[test]
    fn unknown_keys_are_ignored_and_defaults_apply() {
        let p = paint(json!({"type": "solid", "color": "#000000", "extra": 1}));
        assert_eq!((p.opacity, p.visible, p.blend), (1.0, true, BlendMode::Normal));
        assert!(serde_json::from_value::<Paint>(json!({"type": "noise"})).is_err());
        assert!(serde_json::from_value::<Paint>(json!({"type": "solid", "color": "red"})).is_err());
    }

    #[test]
    fn stops_follow_the_end_colours() {
        let Paint { kind: PaintKind::Linear(g), .. } = paint(json!({"type": "linear", "color": "#112233", "color2": "#445566", "stops": [{"pos": 1.0, "color": "#000000"}, {"pos": 0.0, "color": "#ffffff"}]})) else { panic!() };
        let s = g.sorted_stops();
        assert_eq!((s[0].pos, s[0].color.hex()), (0.0, "#112233".into()));
        assert_eq!((s[1].pos, s[1].color.hex()), (1.0, "#445566".into()));
        let two = Gradient::default().sorted_stops();
        assert_eq!((two[0].color.hex(), two[1].color.hex()), ("#d9d9d9".into(), "#ffffff".into()));
    }

    #[test]
    fn a_solid_or_hidden_paint_has_no_layer() {
        assert!(paint(json!({"type": "solid", "color": "#000000"})).layer("x", 1.0, 1.0, None).is_none());
        assert!(paint(json!({"type": "linear", "visible": false})).layer("x", 1.0, 1.0, None).is_none());
    }

    #[test]
    fn linear_and_radial_map_directly() {
        let lin = paint(json!({"type": "linear", "angle": 90.0, "stops": [{"pos": 0.0, "color": "#ff0000"}, {"pos": 1.0, "color": "#0000ff", "alpha": 0.5}]}));
        let l = lin.layer("g", 100.0, 50.0, None).unwrap();
        assert!(l.defs.starts_with("<linearGradient id=\"g\" gradientUnits=\"userSpaceOnUse\""), "{}", l.defs);
        assert!(l.defs.contains("x1=\"50\" y1=\"0\" x2=\"50\" y2=\"50\""), "{}", l.defs);
        assert!(l.defs.contains("stop-opacity=\"0.5\""));
        assert!(l.content.contains("fill=\"url(#g)\"") && !l.flat, "{}", l.content);
        let rad = paint(json!({"type": "radial", "stops": [{"pos": 0.0, "color": "#ffffff"}, {"pos": 1.0, "color": "#000000"}]}));
        let l = rad.layer("r", 200.0, 100.0, None).unwrap();
        assert!(l.defs.starts_with("<radialGradient id=\"r\""));
        assert!(l.defs.contains("matrix(100 0 0 50 100 50)"), "{}", l.defs);
    }

    #[test]
    fn angular_and_diamond_are_never_a_radial_gradient() {
        for kind in ["angular", "diamond"] {
            let p = paint(json!({"type": kind, "stops": [{"pos": 0.0, "color": "#ff0000"}, {"pos": 1.0, "color": "#00ff00"}]}));
            let l = p.layer("g", 100.0, 100.0, None).unwrap();
            assert!(!l.defs.contains("radialGradient") && !l.content.contains("radial"), "{kind}: {l:?}");
            assert!(l.defs.is_empty() && l.flat && l.content.contains("fill=\"#ff0000\""), "{kind}: {l:?}");
        }
    }

    #[test]
    fn image_adjustments_are_an_svg_filter() {
        let p = paint(json!({"type": "image", "image": "a", "iw": 10.0, "ih": 10.0, "adjust": {"exposure": 0.5, "contrast": 0.2, "saturation": -0.5, "temperature": 0.4}}));
        let l = p.layer("im", 100.0, 60.0, Some("data:image/png;base64,AAAA")).unwrap();
        assert!(l.defs.contains("<filter id=\"imf\""), "{}", l.defs);
        for part in ["<feComponentTransfer>", "slope=\"1.5\"", "intercept=\"-0.1\"", "type=\"saturate\" values=\"0.5\"", "type=\"hueRotate\" values=\"6\"", "type=\"matrix\""] {
            assert!(l.defs.contains(part), "missing {part} in {}", l.defs);
        }
        assert!(l.content.contains("filter=\"url(#imf)\""), "{}", l.content);
        let plain = paint(json!({"type": "image", "image": "a", "iw": 10.0, "ih": 10.0})).layer("im", 100.0, 60.0, Some("x.png")).unwrap();
        assert!(!plain.defs.contains("filter") && !plain.content.contains("filter"));
        assert!(paint(json!({"type": "image", "image": "a", "iw": 10.0, "ih": 10.0})).layer("im", 100.0, 60.0, None).is_none(), "no asset yet");
    }

    #[test]
    fn extent_fill_covers_the_box_and_crops_one_axis() {
        let wide = picture_extent(Some("fill"), 120.0, 80.0, (16.0, 16.0), None, None, None).unwrap();
        close(wide.w, 120.0);
        close(wide.h, 120.0);
        close(wide.x, 0.0);
        close(wide.y, -20.0);
        let tall = picture_extent(None, 80.0, 120.0, (200.0, 100.0), None, None, None).unwrap();
        close(tall.h, 120.0);
        close(tall.w, 240.0);
        close(tall.x, -80.0);
        close(tall.y, 0.0);
        assert!(!tall.tile);
    }

    #[test]
    fn extent_fit_is_contained_and_centred() {
        let e = picture_extent(Some("fit"), 120.0, 80.0, (200.0, 100.0), None, None, None).unwrap();
        close(e.w, 120.0);
        close(e.h, 60.0);
        close(e.x, 0.0);
        close(e.y, 10.0);
        let e = picture_extent(Some("fit"), 100.0, 100.0, (50.0, 200.0), None, None, None).unwrap();
        close(e.w, 25.0);
        close(e.h, 100.0);
        close(e.x, 37.5);
    }

    #[test]
    fn extent_crop_zooms_around_its_anchor() {
        let crop = Crop { x: Some(0.5), y: Some(0.5), scale: Some(2.0), rotation: None };
        let e = picture_extent(Some("crop"), 100.0, 100.0, (200.0, 100.0), None, Some(&crop), None).unwrap();
        close(e.w, 400.0);
        close(e.h, 200.0);
        close(e.x, -150.0);
        close(e.y, -50.0);
        let left = Crop { x: Some(0.0), y: Some(1.0), scale: Some(1.0), rotation: None };
        let e = picture_extent(Some("crop"), 100.0, 100.0, (100.0, 100.0), None, Some(&left), None).unwrap();
        close(e.x, 50.0);
        close(e.y, -50.0);
        let plain = picture_extent(Some("crop"), 120.0, 80.0, (16.0, 16.0), None, None, None).unwrap();
        close(plain.w, 120.0);
        close(plain.y, -20.0);
    }

    #[test]
    fn extent_tile_is_the_natural_size_times_the_scale() {
        let e = picture_extent(Some("tile"), 300.0, 200.0, (40.0, 20.0), Some(0.5), None, None).unwrap();
        assert!(e.tile);
        assert_eq!((e.x, e.y, e.w, e.h), (0.0, 0.0, 20.0, 10.0));
    }

    #[test]
    fn extent_carries_the_rotation_and_refuses_what_it_cannot_place() {
        let crop = Crop { rotation: Some(30.0), ..Crop::default() };
        assert_eq!(picture_extent(None, 10.0, 10.0, (4.0, 4.0), None, Some(&crop), None).unwrap().rotation, 30.0);
        assert_eq!(picture_extent(None, 10.0, 10.0, (4.0, 4.0), None, Some(&crop), Some(90.0)).unwrap().rotation, 90.0, "the paint's own turn wins");
        assert!(picture_extent(None, 0.0, 10.0, (4.0, 4.0), None, None, None).is_none());
        assert!(picture_extent(None, 10.0, 10.0, (0.0, 4.0), None, None, None).is_none());
        assert!(paint(json!({"type": "image", "image": "a"})).extent(10.0, 10.0, None).is_none(), "not measured");
        assert!(paint(json!({"type": "image", "image": "a"})).extent(10.0, 10.0, Some((4.0, 4.0))).is_some(), "the caller measured it");
        assert!(paint(json!({"type": "linear"})).extent(10.0, 10.0, Some((4.0, 4.0))).is_none());
    }

    #[test]
    fn an_image_layer_is_drawn_at_its_extent_and_a_tile_is_a_pattern() {
        let fit = paint(json!({"type": "image", "image": "a", "mode": "fit", "rotation": 90.0, "iw": 200.0, "ih": 100.0})).layer("i", 120.0, 80.0, Some("p.png")).unwrap();
        assert!(fit.content.contains("x=\"0\" y=\"10\" width=\"120\" height=\"60\"") && fit.content.contains("rotate(90 60 40)"), "{}", fit.content);
        let tile = paint(json!({"type": "image", "image": "a", "mode": "tile", "scale": 0.5, "iw": 40.0, "ih": 20.0})).layer("i", 100.0, 100.0, Some("p.png")).unwrap();
        assert!(tile.defs.contains("<pattern id=\"i\" patternUnits=\"userSpaceOnUse\" width=\"20\" height=\"10\">"), "{}", tile.defs);
        assert!(tile.content.contains("fill=\"url(#i)\""));
        assert!(paint(json!({"type": "image", "image": "a", "mode": "crop"})).layer("i", 100.0, 100.0, Some("p.png")).is_none(), "the natural size is needed");
    }

    #[test]
    fn a_video_stroke_draws_its_poster() {
        let v = paint(json!({"type": "video", "video": "v", "poster": "p", "mode": "fill", "iw": 10.0, "ih": 10.0}));
        let l = v.layer("v", 80.0, 40.0, Some("poster.png")).unwrap();
        assert!(l.content.contains("poster.png"));
        assert!(v.layer("v", 80.0, 40.0, None).is_none());
    }

    #[test]
    fn a_pattern_tiles_by_its_cell_and_alignment() {
        let p = paint(json!({"type": "pattern", "source": "n", "tileType": "HORIZONTAL_HEXAGONAL", "scale": 1.0, "spacingX": 50.0, "align": "bottom-right", "iw": 10.0, "ih": 10.0}));
        let l = p.layer("p", 33.0, 25.0, Some("t.png")).unwrap();
        // step 15 x 10; the cell is two rows tall with the second tile shifted half a step; 33 and 25 leave 3 and 5 over.
        assert!(l.defs.contains("x=\"3\" y=\"5\" width=\"15\" height=\"20\""), "{}", l.defs);
        assert_eq!(l.defs.matches("<image").count(), 2);
        assert!(paint(json!({"type": "pattern", "source": "n"})).layer("p", 10.0, 10.0, Some("t.png")).is_none(), "needs the tile's measured size");
    }
}
