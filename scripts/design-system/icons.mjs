// Ikon design system: 2 gaya — outline (garis 1.5px) dan bold-duotone (bentuk isi 50% + detail solid),
// mengikuti set WDS. Ikon "ui" di bawah melengkapi kebutuhan komponen yang tidak ada di set WDS lokal.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const ICON_STYLES = ['outline', 'bold-duotone'];
const C = '#1C274C';
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">${body}</svg>`;
const line = d => `<path d="${d}" stroke="${C}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const soft = d => `<path opacity="0.5" d="${d}" fill="${C}"/>`;
const solid = d => `<path d="${d}" fill="${C}"/>`;
const circle = (cx, cy, r, mode) => mode === 'line'
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${C}" stroke-width="1.5"/>`
    : `<circle opacity="${mode === 'soft' ? 0.5 : 1}" cx="${cx}" cy="${cy}" r="${r}" fill="${C}"/>`;
// Pada bold-duotone, detail di atas bentuk 50% digambar dengan warna utama (bukan putih) supaya tetap terbaca
// saat ikon diwarnai currentColor di atas latar apa pun.
const detail = d => line(d);

/** nama → { outline, 'bold-duotone' } */
export const UI_ICONS = {
    calendar: {
        outline: svg(`<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="${C}" stroke-width="1.5"/>${line('M8 3v4M16 3v4M3.5 10h17')}`),
        'bold-duotone': svg(`${soft('M3 10h18v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z')}${solid('M6 4.5h12a3 3 0 0 1 3 3V10H3V7.5a3 3 0 0 1 3-3Z')}${detail('M8 3v3.5M16 3v3.5')}`),
    },
    'danger-circle': {
        outline: svg(`${circle(12, 12, 9, 'line')}${line('M12 7.5V13M12 16.5v.01')}`),
        'bold-duotone': svg(`${circle(12, 12, 10, 'soft')}${line('M12 7v6')}${circle(12, 16.5, 1, 'solid')}`),
    },
    'check-circle': {
        outline: svg(`${circle(12, 12, 9, 'line')}${line('M8.5 12.5 11 15l4.5-5')}`),
        'bold-duotone': svg(`${circle(12, 12, 10, 'soft')}${line('M8.5 12.5 11 15l4.5-5')}`),
    },
    'close-circle': {
        outline: svg(`${circle(12, 12, 9, 'line')}${line('m9.5 9.5 5 5m0-5-5 5')}`),
        'bold-duotone': svg(`${circle(12, 12, 10, 'soft')}${line('m9.5 9.5 5 5m0-5-5 5')}`),
    },
    eye: {
        outline: svg(`${line('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z')}${circle(12, 12, 3, 'line')}`),
        'bold-duotone': svg(`${soft('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z')}${circle(12, 12, 3.5, 'solid')}`),
    },
    'file-text': {
        outline: svg(`${line('M6.5 3h7.5l4.5 4.5V21h-12z')}${line('M14 3v4.5h4.5M9.5 12.5h5M9.5 16h5')}`),
        'bold-duotone': svg(`${soft('M6 2.5h8l5 5V19a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19V5a2.5 2.5 0 0 1 1-2.5Z')}${solid('M14 2.5V6a1.5 1.5 0 0 0 1.5 1.5H19z')}${line('M9 12.5h6M9 16h6')}`),
    },
    filter: {
        outline: svg(line('M4 5h16l-6 7.5V19l-4 1.5v-8z')),
        'bold-duotone': svg(`${soft('M3.5 4.5h17l-6.5 8v6.5l-4 2v-8.5z')}${solid('M3.5 4.5h17l-3 3.75h-11z')}`),
    },
    'info-circle': {
        outline: svg(`${circle(12, 12, 9, 'line')}${line('M12 11v5.5M12 7.5v.01')}`),
        'bold-duotone': svg(`${circle(12, 12, 10, 'soft')}${line('M12 11v6')}${circle(12, 7.5, 1, 'solid')}`),
    },
    logout: {
        outline: svg(line('M13.5 4H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7M10 12h10.5M17.5 9l3 3-3 3')),
        'bold-duotone': svg(`${soft('M6 3h8v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z')}${line('M10 12h10.5M17.5 9l3 3-3 3')}`),
    },
    'hamburger-menu': {
        outline: svg(line('M4 6.5h16M4 12h16M4 17.5h16')),
        'bold-duotone': svg(`${line('M4 6.5h16M4 17.5h16')}<path opacity="0.5" d="M4 12h16" stroke="${C}" stroke-width="1.5" stroke-linecap="round"/>`),
    },
    add: {
        outline: svg(line('M12 5v14M5 12h14')),
        'bold-duotone': svg(`${circle(12, 12, 10, 'soft')}${line('M12 8v8M8 12h8')}`),
    },
    magnifer: {
        outline: svg(`${circle(11, 11, 6.5, 'line')}${line('m16 16 4.5 4.5')}`),
        'bold-duotone': svg(`${circle(11, 11, 7.5, 'soft')}${line('m16.5 16.5 4 4')}`),
    },
    settings: {
        outline: svg(`${circle(12, 12, 3, 'line')}${line('M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8')}`),
        'bold-duotone': svg(`${circle(12, 12, 8, 'soft')}${circle(12, 12, 3, 'solid')}${line('M12 2.5V4M12 20v1.5M2.5 12H4M20 12h1.5')}`),
    },
    'trash-bin': {
        outline: svg(line('M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5')),
        'bold-duotone': svg(`${soft('M5.5 7h13l-1 12.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5z')}${line('M3.5 7h17M9.5 7V4h5v3')}${line('M10 11v5.5M14 11v5.5')}`),
    },
    'danger-triangle': {
        outline: svg(`${line('M12 4 21 19.5H3z')}${line('M12 10v4.5M12 17v.01')}`),
        'bold-duotone': svg(`${soft('M10.3 3.5a2 2 0 0 1 3.4 0l8.4 14.5a2 2 0 0 1-1.7 3H3.6a2 2 0 0 1-1.7-3z')}${line('M12 9v5')}${circle(12, 17, 1, 'solid')}`),
    },
    widget: {
        outline: svg(`<rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke="${C}" stroke-width="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke="${C}" stroke-width="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke="${C}" stroke-width="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" stroke="${C}" stroke-width="1.5"/>`),
        'bold-duotone': svg(`${solid('M3 5.5A2.5 2.5 0 0 1 5.5 3h3A2.5 2.5 0 0 1 11 5.5v3A2.5 2.5 0 0 1 8.5 11h-3A2.5 2.5 0 0 1 3 8.5z')}${soft('M13 5.5A2.5 2.5 0 0 1 15.5 3h3A2.5 2.5 0 0 1 21 5.5v3a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 13 8.5zM3 15.5A2.5 2.5 0 0 1 5.5 13h3a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 1 8.5 21h-3A2.5 2.5 0 0 1 3 18.5z')}${solid('M13 15.5a2.5 2.5 0 0 1 2.5-2.5h3a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5h-3a2.5 2.5 0 0 1-2.5-2.5z')}`),
    },
    user: {
        outline: svg(`${circle(12, 7.5, 3.75, 'line')}${line('M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6')}`),
        'bold-duotone': svg(`${circle(12, 7, 4, 'solid')}${soft('M4 20c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z')}`),
    },
    'shield-check': {
        outline: svg(`${line('M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z')}${line('m9 12 2 2 4-4')}`),
        'bold-duotone': svg(`${soft('M12 2.5 4 5.75v5.75c0 4.9 3.4 8.7 8 10.25 4.6-1.55 8-5.35 8-10.25V5.75z')}${line('m9 12 2 2 4-4')}`),
    },
    chart: {
        outline: svg(line('M4 20.5h16M6.5 20.5V13M11 20.5V8M15.5 20.5v-6M20 20.5V4.5')),
        'bold-duotone': svg(`${soft('M5 13.5a1.5 1.5 0 0 1 3 0V20H5zM14 15a1.5 1.5 0 0 1 3 0v5h-3z')}${solid('M9.5 8.5a1.5 1.5 0 0 1 3 0V20h-3zM18.5 5a1.5 1.5 0 0 1 3 0v15h-3z')}${line('M3 20.75h18')}`),
    },
    close: {
        outline: svg(line('m6 6 12 12M18 6 6 18')),
        'bold-duotone': svg(`${line('M6 6l12 12')}<path opacity="0.5" d="M18 6 6 18" stroke="${C}" stroke-width="1.5" stroke-linecap="round"/>`),
    },
};

/** Ikon Studio: file SVG berpola `<gaya>/<kategori>/<nama>.svg` untuk buildIconPage. */
export function uiIconFiles() {
    return Object.entries(UI_ICONS).flatMap(([name, styles]) => ICON_STYLES.map(style => ({ path: `ui/${style}/ui/${name}.svg`, svg: styles[style] })));
}

/** Set WDS lokal (bila ada), hanya gaya yang dipakai design system. */
export function wdsIconFiles(dir) {
    if (!existsSync(dir)) return [];
    const out = [];
    const walk = d => {
        for (const f of readdirSync(d)) {
            const p = join(d, f);
            if (statSync(p).isDirectory()) walk(p);
            else if (f.endsWith('.svg')) out.push({ path: `wds/${relative(dir, p).split(sep).join('/')}`, svg: readFileSync(p, 'utf8') });
        }
    };
    for (const style of ICON_STYLES) if (existsSync(join(dir, style))) walk(join(dir, style));
    return out;
}

