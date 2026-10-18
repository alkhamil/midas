// Ikon design system CMS: satu gaya, outline (garis 1.5 px, ujung bulat), digambar di kotak 24 × 24.
// Warna dasar #1C274C diganti dengan warna token saat dipakai di desain (lihat ctx.icon).

export const ICON_STYLES = ['outline'];
const C = '#1C274C';
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">${body}</svg>`;
const line = d => `<path d="${d}" stroke="${C}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${C}" stroke-width="1.5"/>`;
const rect = (x, y, w, h, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" stroke="${C}" stroke-width="1.5"/>`;

/** nama → SVG outline */
export const UI_ICONS = {
    widget: svg(`${rect(3.5, 3.5, 7, 7, 2)}${rect(13.5, 3.5, 7, 7, 2)}${rect(3.5, 13.5, 7, 7, 2)}${rect(13.5, 13.5, 7, 7, 2)}`),
    user: svg(`${circle(12, 7.5, 3.75)}${line('M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6')}`),
    'shield-check': svg(`${line('M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z')}${line('m9 12 2 2 4-4')}`),
    chart: svg(line('M4 20.5h16M6.5 20.5V13M11 20.5V8M15.5 20.5v-6M20 20.5V4.5')),
    add: svg(line('M12 5v14M5 12h14')),
    pen: svg(line('m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19ZM14.5 6.5l3 3')),
    'trash-bin': svg(line('M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5')),
    eye: svg(`${line('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z')}${circle(12, 12, 3)}`),
    'eye-closed': svg(line('M3 3l18 18M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9M6.4 6.9A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2')),
    magnifer: svg(`${circle(11, 11, 6.5)}${line('m16 16 4.5 4.5')}`),
    filter: svg(line('M4 5h16l-6 7.5V19l-4 1.5v-8z')),
    settings: svg(`${circle(12, 12, 3)}${line('M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8')}`),
    logout: svg(line('M13.5 4H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7M10 12h10.5M17.5 9l3 3-3 3')),
    close: svg(line('m6 6 12 12M18 6 6 18')),
    'check-circle': svg(`${circle(12, 12, 9)}${line('M8.5 12.5 11 15l4.5-5')}`),
    'close-circle': svg(`${circle(12, 12, 9)}${line('m9.5 9.5 5 5m0-5-5 5')}`),
    'info-circle': svg(`${circle(12, 12, 9)}${line('M12 11v5.5M12 7.5v.01')}`),
    'danger-triangle': svg(`${line('M12 4 21 19.5H3z')}${line('M12 10v4.5M12 17v.01')}`),
    'hamburger-menu': svg(line('M4 6.5h16M4 12h16M4 17.5h16')),
    'alt-arrow-down': svg(line('m6 9.5 6 6 6-6')),
    'alt-arrow-up': svg(line('m6 14.5 6-6 6 6')),
    'alt-arrow-left': svg(line('m14.5 6-6 6 6 6')),
    'alt-arrow-right': svg(line('m9.5 6 6 6-6 6')),
    'double-alt-arrow-left': svg(line('m12.5 6-6 6 6 6M18.5 6l-6 6 6 6')),
    'double-alt-arrow-right': svg(line('m11.5 6 6 6-6 6M5.5 6l6 6-6 6')),
    'arrow-up': svg(line('M12 19V5M6 11l6-6 6 6')),
    'arrow-down': svg(line('M12 5v14M6 13l6 6 6-6')),
};

/** Ikon Studio: file SVG berpola `<gaya>/<kategori>/<nama>.svg` untuk buildIconPage (kategori "ui"). */
export function uiIconFiles() {
    return Object.entries(UI_ICONS).map(([name, body]) => ({ path: `ui/outline/ui/${name}.svg`, svg: body }));
}
