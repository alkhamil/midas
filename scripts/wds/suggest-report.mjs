// How well does the Convention suggest presets and slot mappings for the components of a .midas file?
//   node scripts/wds/suggest-report.mjs "<file.midas>" [--list]
// For every component (a set counts once, through its first variant): the preset its name suggests, then for that preset the role
// slots (value, placeholder, item, label…) that have a layer to suggest. "Needs manual" = a required slot with no suggestion.
import fs from 'fs';
import zlib from 'zlib';
import { PRESET_MAP, PRESETS, CAPABILITIES, SLOT_ROLES, planPreset, suggestPreset, suggestSlots, cleanConvention } from '../../packages/builder-core/src/index.js';

const file = process.argv[2];
let buf = fs.readFileSync(file);
if (buf[0] === 0x1f) buf = zlib.gunzipSync(buf);
const doc = JSON.parse(buf);
const conv = cleanConvention(doc.convention);
const all = doc.pages.flatMap(p => p.nodes.map(n => ({ ...n, _page: p.name.trim() })));
const kids = new Map();
for (const n of all) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n); }
const sub = id => { const out = []; const walk = i => { for (const k of kids.get(i) || []) { out.push(k); walk(k.id); } }; walk(id); return out; };

// the component of a set: its first variant; a plain main component stands for itself
const comps = [];
for (const n of all) {
    if (n.componentSet) { const v = (kids.get(n.id) || []).find(x => x.component); if (v) comps.push({ name: n.name, root: v, page: n._page }); }
    else if (n.component && !all.find(p => p.id === n.parentId)?.componentSet) comps.push({ name: n.name, root: n, page: n._page });
}

const rows = [];
for (const c of comps) {
    const layers = sub(c.root.id).filter(l => !l.softDeleted).map(l => ({ id: l.id, name: l.name, type: l.type, isInstance: !!l.isInstance }));
    const presetId = suggestPreset(c.name, PRESETS);
    if (!presetId) { rows.push({ ...c, presetId: null }); continue; }
    const plan = planPreset(presetId), wanted = new Set();
    for (const cap of PRESET_MAP[presetId].caps) for (const s of CAPABILITIES[cap.kind].slots) wanted.add(JSON.stringify([s.role, !!s.required]));
    const roles = [...wanted].map(JSON.parse).filter(([r]) => SLOT_ROLES[r].kind !== 'component').map(([role, required]) => ({ role, required, kind: SLOT_ROLES[role].kind }));
    const sug = suggestSlots(roles, layers, conv);
    const got = new Map(sug.map(s => [s.role, s]));
    const requiredMissing = roles.filter(r => r.required && !got.has(r.role)).map(r => r.role);
    rows.push({ ...c, presetId, roles, got, requiredMissing, layerCount: layers.length });
}
const withPreset = rows.filter(r => r.presetId), complete = withPreset.filter(r => !r.requiredMissing.length), needsManual = withPreset.filter(r => r.requiredMissing.length);
console.log(`${file}\ncomponents: ${rows.length} · preset suggested: ${withPreset.length} · no preset (a layout piece, an icon…): ${rows.length - withPreset.length}`);
console.log(`of the ${withPreset.length} with a preset: every required slot suggested: ${complete.length} · needs manual mapping: ${needsManual.length}`);
const byPreset = {};
for (const r of withPreset) { const b = (byPreset[r.presetId] ||= { n: 0, complete: 0 }); b.n++; if (!r.requiredMissing.length) b.complete++; }
console.log('by preset:', Object.entries(byPreset).map(([k, v]) => `${k} ${v.complete}/${v.n}`).join(' · '));
if (process.argv.includes('--list')) {
    for (const r of withPreset) console.log(`${r.requiredMissing.length ? '✗' : '✓'} ${r.page} / ${r.name} → ${r.presetId}: ${[...r.got.values()].map(s => `${s.role}=“${s.name}”`).join(', ') || '—'}${r.requiredMissing.length ? `   (missing: ${r.requiredMissing.join(', ')})` : ''}`);
}
