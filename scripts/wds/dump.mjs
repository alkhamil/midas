import fs from 'fs'; import zlib from 'zlib';
let b = fs.readFileSync(process.argv[2]); if (b[0] === 0x1f) b = zlib.gunzipSync(b);
const d = JSON.parse(b); const V = d.variables;
const coll = n => V.collections.find(c => c.name === n);
const nameOf = id => { const i = V.items.find(x => x.id === id); return i ? `${V.collections.find(c=>c.id===i.collectionId).name}/${i.name}` : id; };
const show = (cn) => { const c = coll(cn); console.log('\n##', cn, c.modes.map(m=>m.name).join(' | '));
  for (const i of V.items.filter(x => x.collectionId === c.id)) console.log(' ', i.type, i.name, '=>', c.modes.map(m => { const v = i.values[m.id]; return v && v.alias ? nameOf(v.alias) : JSON.stringify(v); }).join(' | ')); };
for (const n of process.argv.slice(3)) show(n);
