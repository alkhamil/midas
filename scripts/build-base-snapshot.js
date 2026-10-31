// Builds the committed base variable snapshot from the token JSON: the five source collections (Primitives, Semantic,
// Size, Typography, Icons) after mapping, with modes, variable paths, types, alias refs and derived flags. The ~100
// component-specific collections are never in the snapshot. Run `node scripts/build-base-snapshot.js <token-json-path>`,
// then commit the snapshot; the studio reads it, never the token JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTokenJson, buildBasePlan } from '../packages/builder-core/src/base-tokens/importer.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(here, '../packages/builder-core/src/base-tokens/base-snapshot.json');

const [input] = process.argv.slice(2);
if (!input) {
    console.error('Usage: node scripts/build-base-snapshot.js <token-json-path>');
    process.exit(1);
}
const plan = buildBasePlan(parseTokenJson(JSON.parse(readFileSync(input, 'utf8'))));
writeFileSync(SNAPSHOT_PATH, JSON.stringify(plan, null, 2) + '\n');
const { report } = plan;
console.log(`collections: ${plan.collections.map(c => `${c.name} (${c.modes.join(', ')})`).join(', ')}`);
console.log(`variables: ${plan.items.length}`);
console.log(`derived: ${report.derived.length}${report.derived.map(d => `\n  ${d.name} (${d.reason})`).join('')}`);
console.log(`needs value: ${report.needsValue.length}${report.needsValue.map(d => `\n  ${d.name} (${d.reason})`).join('')}`);
console.log(`renamed: ${report.renamed.length}`);
console.log(`unresolved: ${report.unresolved.length}${report.unresolved.map(u => `\n  ${u.collection}/${u.mode}/${u.path} ({${u.ref}})`).join('')}`);
