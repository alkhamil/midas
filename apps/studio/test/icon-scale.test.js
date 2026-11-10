// An icon instance sized to a slot (the icon size token) keeps its frame at that size and scales the glyph inside by the Scale constraint: uniformly (the frame is
// square), without distortion, the tight box staying tight. constrainInstanceLayers is cut out of midas.js by name (as studioReplay.js does), so this runs the real pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ICON_SET, iconNodes } from '@midas/builder-core';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function sliceFunction(name) {
    const head = src.indexOf(`\nfunction ${name}(`) + 1;
    if (head < 1) throw new Error(`midas.js has no function ${name}`);
    return src.slice(head, src.indexOf('\n}\n', head) + 2);
}
const isAutoLayout = n => !!n.layout && n.layout !== 'none';
const run = pages => new Function('isAutoLayout', 'nodeIndex', `${sliceFunction('constrainInstanceLayers')}\nreturn constrainInstanceLayers;`)(isAutoLayout, () => new Map(pages.flatMap(p => p.nodes).map(n => [n.id, n])))(pages);

/** An instance of the icon at a size: the frame resized, its glyph copied from the master as an instance copy does. */
function instanceAt(entry, size) {
    const [root, path] = iconNodes(entry, key => key);
    const inst = { ...root, id: 'inst', component: false, isInstance: true, sourceId: root.id, parentId: 'host', w: size, h: size };
    const copy = { ...path, id: 'inst-path', parentId: 'inst', sourceId: path.id, isInstance: true };
    return { root, path, inst, copy, pages: [{ nodes: [root, path, inst, copy] }] };
}

for (const entry of ICON_SET) {
    test(`${entry.name}: the glyph scales uniformly with the icon frame at every icon size, staying tight`, () => {
        for (const size of [12, 14, 16, 20, 24, 32]) {
            const { path, inst, copy, pages } = instanceAt(entry, size);
            run(pages);
            const f = size / 24;
            assert.deepEqual([inst.w, inst.h], [size, size], 'the frame keeps its token-bound size');
            for (const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(copy[k] - path[k] * f) < 1e-9, `${entry.name} @${size}: ${k} ${copy[k]} vs ${path[k] * f}`);
            assert.ok(Math.abs(copy.w / copy.h - path.w / path.h) < 1e-9, 'no distortion: the aspect of the glyph is kept');
            assert.ok(copy.x >= 0 && copy.y >= 0 && copy.x + copy.w <= size + 1e-9 && copy.y + copy.h <= size + 1e-9, 'inside the frame');
        }
    });
}
