import fs from 'fs'; import zlib from 'zlib';
let b = fs.readFileSync(process.argv[2]); if (b[0] === 0x1f) b = zlib.gunzipSync(b);
const d = JSON.parse(b); const V = d.variables;
const page = d.pages.find(p => p.name.trim() === process.argv[3]);
const nodes = page.nodes;
const collName = id => V.collections.find(c => c.id === id)?.name;
const modeName = (c, m) => V.collections.find(x => x.id === c)?.modes.find(y => y.id === m)?.name;
const depth = +process.argv[4] || 2;
const kids = id => nodes.filter(n => n.parentId === id);
const show = (n, dep, ind) => {
  const vm = n.varModes ? ' vm{' + Object.entries(n.varModes).map(([c, m]) => collName(c) + '=' + modeName(c, m)).join(', ') + '}' : '';
  console.log(ind + `${n.type} "${n.name}"${n.componentSet ? ' [SET]' : ''}${n.component ? ' [COMP]' : ''}${n.isInstance ? ' [INST]' : ''}${n.variant ? ' variant=' + JSON.stringify(n.variant) : ''}${vm} ${Math.round(n.w)}x${Math.round(n.h)}`);
  if (dep > 0) for (const k of kids(n.id)) show(k, dep - 1, ind + '  ');
};
for (const r of nodes.filter(n => !n.parentId)) show(r, depth, '');
