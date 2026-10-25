import fs from 'fs'; import zlib from 'zlib';
const f = process.argv[2];
let b = fs.readFileSync(f); if (b[0] === 0x1f) b = zlib.gunzipSync(b);
const d = JSON.parse(b);
console.log(d.name, 'pages:', d.pages.map(p => `${p.name}(${p.nodes.length})`).join(', '));
const V = d.variables; console.log('collections', V.collections.length, 'items', V.items.length);
for (const c of V.collections) console.log(' -', c.name, '|', c.modes.map(m => m.name).join('/'), '|', V.items.filter(i => i.collectionId === c.id).length);
