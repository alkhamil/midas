// Builds a reproduction of an imported Figma login page: a vertical auto layout card whose children are stored back to front (layoutFlip,
// layoutReverseZ, as the importer writes them), a logo, a title and subtitle, two input fields (the password one with an eye icon: a
// vector path with two contours and the even-odd rule), a dashed box and a dotted stroke, and a CTA row holding a Button instance with
// its label "Done". Run `node scripts/make-login-fixture.js` to write the file.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildPrototypeFixture } from './make-prototype-fixture.js';
import { BEHAVIOR_DATA_VERSION } from '../packages/builder-core/src/behavior-engine/data.js';

const here = dirname(fileURLToPath(import.meta.url));
export const LOGIN_FIXTURE_PATH = resolve(here, 'fixtures/login-fixture.midas');

const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity, visible: true }]);
const base = (id, name, type, parentId, extra = {}) => ({ id, name, type, parentId, x: 0, y: 0, w: 100, h: 40, fills: solid('#ffffff'), stroke: '#000000', strokeWidth: 0, opacity: 1, rotation: 0, visible: true, locked: false, version: 0, ...extra });
const text = (id, parentId, content, extra = {}) => base(id, content, 'text', parentId, {
    text: content, w: 327, h: 24, fills: solid('#20202a'), fontFamily: 'Inter', fontSize: 16, fontWeight: 400, fontStyle: 'normal',
    lineHeight: 1.35, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', ...extra,
});
/** A rectangle-like box: a frame with the importer's auto layout fields. */
const box = (id, parentId, name, extra = {}) => base(id, name, 'frame', parentId, { clip: false, ...extra });
/** A vector path from points in its own box. */
const vector = (id, parentId, name, contours, extra = {}) => base(id, name, 'path', parentId, { w: 24, h: 24, pathW: 24, pathH: 24, closed: true, ...contours, ...extra });
/** The Button master of the prototype fixture, instanced with a label. */
const button = (id, parentId, label) => ({
    id, name: label, type: 'frame', parentId, x: 0, y: 0, w: 136, h: 48, isInstance: true, sourceId: 'main', version: 0,
    layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#0058CA'), radius: 8,
    behavior: { version: BEHAVIOR_DATA_VERSION, props: { label, disabled: false, hasIcon: false } },
    varModes: { 'c-variant': 'primary', 'c-size': 'lg' },
});
const square = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

/** The eye icon: an outer ring and a pupil, as two contours of one path, drawn with the even-odd rule. */
const eyeContours = {
    fillRule: 'evenodd',
    contours: [
        { points: square(1, 6, 22, 12), closed: true },
        { points: square(8, 9, 8, 6), closed: true },
    ],
    points: square(1, 6, 22, 12),
};

/** The CTA-row stack order: stored back to front (the importer's layoutFlip), so the first visual child is the last stored. */
export function buildLoginFixture() {
    const doc = buildPrototypeFixture();
    doc.name = 'Login fixture';
    const card = box('login-card', null, 'Login card', {
        x: 0, y: 0, w: 375, h: 812, layout: 'vertical', layoutFlip: true, layoutReverseZ: true, gap: 16, padding: 24, padL: 24, padT: 24, padR: 24, padB: 24,
        primaryAlign: 'start', counterAlign: 'center', layoutSizingH: 'fixed', layoutSizingV: 'fixed', fills: solid('#ffffff'), clip: true,
    });
    const logo = base('login-logo', 'Logo', 'ellipse', 'login-card', { w: 48, h: 48, layoutSizingH: 'fixed', layoutSizingV: 'fixed', fills: solid('#0058CA') });
    const title = text('login-title', 'login-card', 'Welcome back', { fontSize: 28, fontWeight: 700, h: 36 });
    const subtitle = text('login-subtitle', 'login-card', 'Sign in to continue', { h: 24 });
    const email = box('login-email', 'login-card', 'Email', {
        w: 327, h: 48, layout: 'horizontal', gap: 8, padding: 12, padL: 12, padT: 12, padR: 12, padB: 12, primaryAlign: 'start', counterAlign: 'center',
        layoutSizingH: 'fill', layoutSizingV: 'hug', radius: 8, fills: solid('#ffffff'), stroke: '#c4c4cc', strokeWidth: 1,
    });
    const emailText = text('login-email-text', 'login-email', 'Email', { w: 200, h: 24, fills: solid('#8a8a96') });
    const password = box('login-password', 'login-card', 'Password', {
        w: 327, h: 48, layout: 'horizontal', gap: 8, padding: 12, padL: 12, padT: 12, padR: 12, padB: 12, primaryAlign: 'between', gapAuto: true, gapMode: 'between', counterAlign: 'center',
        layoutSizingH: 'fill', layoutSizingV: 'hug', radius: 8, fills: solid('#ffffff'), stroke: '#c4c4cc', strokeWidth: 1,
    });
    const passwordText = text('login-password-text', 'login-password', 'Password', { w: 200, h: 24, fills: solid('#8a8a96') });
    const eye = box('login-eye', 'login-password', 'Eye', { w: 24, h: 24, layoutSizingH: 'fixed', layoutSizingV: 'fixed', fills: solid('none') });
    const eyePath = vector('login-eye-path', 'login-eye', 'Eye icon', eyeContours, { fills: solid('#20202a'), fillRule: 'evenodd', stroke: '#20202a', strokeWidth: 0 });
    const forgot = text('login-forgot', 'login-card', 'Forgot password?', { fontSize: 14, h: 20, textAlign: 'right', fills: solid('#0058CA') });
    const dashed = base('login-dashed', 'Dashed rule', 'rect', 'login-card', { w: 327, h: 2, fills: solid('none'), stroke: '#0058CA', strokeWidth: 2, strokeStyle: 'dash', strokeDash: 6, strokeGap: 4, strokeCap: 'butt', layoutSizingH: 'fill', layoutSizingV: 'fixed' });
    // Icons as Figma imports them: a dashed closed path, a dashed open path, and a dotted round-cap line (a zero dash with round caps).
    const icons = box('login-icons', 'login-card', 'Icons', { w: 327, h: 48, layout: 'horizontal', gap: 16, padding: 0, padL: 0, padT: 0, padR: 0, padB: 0, primaryAlign: 'start', counterAlign: 'center', layoutSizingH: 'fill', layoutSizingV: 'fixed', fills: solid('none') });
    const square = vector('login-icon-dash', 'login-icons', 'Dashed square', { points: [{ x: 4, y: 4 }, { x: 44, y: 4 }, { x: 44, y: 44 }, { x: 4, y: 44 }], closed: true }, { w: 48, h: 48, pathW: 48, pathH: 48, fills: solid('none'), stroke: '#0058CA', strokeWidth: 3, strokeStyle: 'dash', strokeDash: 6, strokeGap: 4, strokeCap: 'butt', strokeJoin: 'miter', layoutSizingH: 'fixed', layoutSizingV: 'fixed' });
    const zigzag = vector('login-icon-open', 'login-icons', 'Dashed open path', { points: [{ x: 4, y: 40 }, { x: 16, y: 8 }, { x: 28, y: 40 }, { x: 44, y: 8 }], closed: false }, { w: 48, h: 48, pathW: 48, pathH: 48, fills: solid('none'), stroke: '#c0392b', strokeWidth: 2, strokeStyle: 'dash', strokeDash: 8, strokeGap: 4, strokeCap: 'round', strokeJoin: 'round', layoutSizingH: 'fixed', layoutSizingV: 'fixed' });
    const dots = vector('login-icon-dot', 'login-icons', 'Dotted line', { points: [{ x: 4, y: 24 }, { x: 44, y: 24 }], closed: false }, { w: 48, h: 48, pathW: 48, pathH: 48, fills: solid('none'), stroke: '#20202a', strokeWidth: 4, strokeStyle: 'dash', strokeDash: 0, strokeGap: 8, strokeCap: 'round', strokeJoin: 'round', layoutSizingH: 'fixed', layoutSizingV: 'fixed' });
    const cta = box('login-cta', 'login-card', 'CTA row', {
        w: 327, h: 56, layout: 'horizontal', gap: 0, padding: 0, padL: 0, padT: 0, padR: 0, padB: 0, primaryAlign: 'center', counterAlign: 'center',
        layoutSizingH: 'fill', layoutSizingV: 'fixed', fills: solid('none'),
    });
    const done = button('login-done', 'login-cta', 'Done');
    // Stored back to front: the last visual child first. The card's flow is the reverse of this list.
    const stored = [cta, icons, forgot, password, email, subtitle, title, logo];
    const storedPrimitives = [done];
    const nodes = [card, ...stored, ...storedPrimitives, emailText, passwordText, eye, eyePath, dashed, square, zigzag, dots].filter((n, i, all) => all.indexOf(n) === i);
    doc.pages.push({ id: 'page-login', name: 'Login', nodes });
    return doc;
}

// Run directly: write the fixture file (the directory is created if missing).
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    mkdirSync(dirname(LOGIN_FIXTURE_PATH), { recursive: true });
    writeFileSync(LOGIN_FIXTURE_PATH, JSON.stringify(buildLoginFixture(), null, 2) + '\n');
    console.log(`Wrote ${LOGIN_FIXTURE_PATH}`);
}
