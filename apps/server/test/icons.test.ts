import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
// Modul Studio yang membangun page Icons — dipakai di sini supaya format kedua sisi pasti cocok.
// @ts-expect-error modul JS tanpa tipe
import { buildIconPage } from '../../studio/src/iconSet.js';
import { collectIcons, iconExportName, normalizeSvg } from '../src/lib/icons.js';
import { buildKit } from '../src/lib/kit.js';
import { deriveMappings, type LibrarySnapshot, type SnapshotComponent } from '../src/lib/library.js';

const WDS = new URL('./fixtures/wds/', import.meta.url);
const svg = (style: string, file: string) => readFileSync(new URL(`${style}/arrows/${file}.svg`, WDS), 'utf8');
let n = 0;
const uid = () => `id${++n}`;

/** Sama seperti librarySnapshot() di engine: root = component set, beserta subtree-nya. */
function snapshotFrom(page: { nodes: { id: string; parentId: string | null; componentSet?: boolean; name: string }[] }, assets: Record<string, string>): LibrarySnapshot {
    const roots = page.nodes.filter(x => x.componentSet);
    const components = roots.map(r => {
        const ids = new Set([r.id]);
        for (let grew = true; grew;) {
            grew = false;
            for (const x of page.nodes) if (x.parentId && ids.has(x.parentId) && !ids.has(x.id)) { ids.add(x.id); grew = true; }
        }
        return { id: r.id, name: r.name, set: true, nodes: page.nodes.filter(x => ids.has(x.id)).map(x => (x.id === r.id ? { ...x, parentId: null } : x)) } as SnapshotComponent;
    });
    return { components, variables: { collections: [], items: [] }, assets };
}

test('normalizeSvg switches the main color to currentColor and keeps opacity', () => {
    const out = normalizeSvg(svg('line-duotone', 'arrow-left'))!;
    assert.equal(out.viewBox, '0 0 24 24');
    assert.doesNotMatch(out.body, /#1C274C/i);
    assert.match(out.body, /opacity="0\.5"/);
    assert.match(out.body, /stroke="currentColor"/);
    const keepWhite = normalizeSvg('<svg viewBox="0 0 24 24"><path fill="#111"/><path fill="#111"/><path fill="white"/></svg>')!;
    assert.match(keepWhite.body, /fill="white"/);
    assert.equal(normalizeSvg('<svg viewBox="0 0 24 24"><path fill="#111" onclick="x()"/></svg>')!.body, '<path fill="currentColor"/>');
    // Atribut stroke di <svg> (gaya ikon garis) dibawa ke <g> dan warnanya jadi currentColor.
    assert.equal(normalizeSvg('<svg viewBox="0 0 24 24" fill="none" stroke="#1C274C" stroke-width="1.5"><path d="M5 12h14"/></svg>')!.body,
        '<g stroke="currentColor" stroke-width="1.5"><path d="M5 12h14"/></g>');
});

test('iconExportName', () => {
    assert.equal(iconExportName('arrow-left'), 'ArrowLeftIcon');
    assert.equal(iconExportName('4k'), 'Icon4kIcon');
});

test('Studio icon page → Library Kit icon components', () => {
    const files = ['outline', 'bold', 'line-duotone'].flatMap(style => ['arrow-left', 'arrow-right'].map(name => ({ path: `wds/${style}/arrows/${name}.svg`, svg: svg(style, name) })));
    const { page, assets, count, styles } = buildIconPage(files, { uid });
    assert.equal(count, 2);
    assert.deepEqual(styles, ['bold', 'line-duotone', 'outline']);
    const snapshot = snapshotFrom(page, assets);
    assert.deepEqual(deriveMappings(snapshot), [], 'icons are not mapped as components');
    const { icons, warnings } = collectIcons(snapshot);
    assert.deepEqual(warnings, []);
    assert.deepEqual(icons.map(i => [i.name, i.category, i.exportName, Object.keys(i.styles).sort()]), [
        ['arrow-left', 'arrows', 'ArrowLeftIcon', ['bold', 'line-duotone', 'outline']],
        ['arrow-right', 'arrows', 'ArrowRightIcon', ['bold', 'line-duotone', 'outline']],
    ]);
    const kit = buildKit({ packageName: '@midas/ui-x', version: '1.0.0', libraryName: 'X', publishedAt: new Date(0), snapshot, mappings: [] });
    assert.match(kit['src/generated/icons/createIcon.tsx'], /export type IconStyle = "bold" \| "line-duotone" \| "outline";/);
    assert.match(kit['src/generated/icons/createIcon.tsx'], /defaultIconStyle: IconStyle = "outline"/);
    assert.match(kit['src/generated/icons/ArrowLeftIcon.ts'], /export const ArrowLeftIcon = \/\* @__PURE__ \*\/ createIcon\("arrow-left"/);
    assert.match(kit['src/generated/icons/registry.ts'], /export const iconNames: IconName\[\] = \["arrow-left", "arrow-right"\];/);
    assert.match(kit['src/generated/icons/registry.ts'], /"arrow-right": ArrowRightIcon,/);
    assert.match(kit['src/generated/index.ts'], /export \* from '\.\/icons';/);
    const manifest = JSON.parse(kit['src/generated/manifest.json']);
    assert.equal(manifest.icons.length, 2);
});

test('re-importing replaces icons with the same name and keeps the others', () => {
    const first = buildIconPage([{ path: 'wds/outline/arrows/arrow-left.svg', svg: svg('outline', 'arrow-left') }, { path: 'wds/outline/arrows/arrow-up.svg', svg: svg('outline', 'arrow-up') }], { uid });
    const again = buildIconPage([{ path: 'wds/bold/arrows/arrow-left.svg', svg: svg('bold', 'arrow-left') }], { uid, existing: first.page });
    const sets = again.page.nodes.filter((x: { componentSet?: boolean }) => x.componentSet).map((x: { name: string }) => x.name).sort();
    assert.deepEqual(sets, ['Icon/arrows/arrow-left', 'Icon/arrows/arrow-up']);
    const left = again.page.nodes.find((x: { name: string }) => x.name === 'Icon/arrows/arrow-left');
    const variants = again.page.nodes.filter((x: { parentId: string }) => x.parentId === left.id).map((x: { name: string }) => x.name);
    assert.deepEqual(variants, ['Style=bold']);
});

test('removing a token, an icon or an icon style is a breaking change', async () => {
    const { kitBreakingChanges, buildManifest } = await import('../src/lib/kit.js');
    const files = ['outline', 'bold'].map(style => ({ path: `wds/${style}/arrows/arrow-left.svg`, svg: svg(style, 'arrow-left') }));
    const { page, assets } = buildIconPage(files, { uid });
    const snapshot = snapshotFrom(page, assets);
    snapshot.variables = { collections: [{ id: 'c', name: 'C', modes: [{ id: 'm', name: 'Base' }] }], items: [{ id: 'v', collectionId: 'c', name: 'color/primary', type: 'color', values: { m: '#000' } }] };
    const prev = buildManifest({ packageName: '@midas/x', version: '1.0.0', libraryName: 'X', publishedAt: new Date(0), snapshot, mappings: [] });
    assert.deepEqual(kitBreakingChanges(prev, snapshot), []);
    const outline = buildIconPage([files[0]], { uid });
    const onlyOutline = snapshotFrom(outline.page, outline.assets);
    const out = kitBreakingChanges(prev, onlyOutline);
    assert.ok(out.includes('Token primary was removed'));
    assert.ok(out.includes('Icon arrow-left: style bold was removed'));
    assert.deepEqual(kitBreakingChanges(prev, { components: [], variables: snapshot.variables, assets: {} }), ['Icon arrow-left was removed']);
});
