// Builds the committed base variable snapshot from the token JSON: the three base collections (Primitives, Semantic,
// Typography) after mapping, with modes, variable paths, types, alias refs and derived flags. The ~100
// component-specific collections are never in the snapshot.
//
// Usage: node scripts/build-base-snapshot.js [token-json-path]
//   token-json-path defaults to packages/builder-core/src/base-tokens/source/token.json (the Figma variables export, not in
//   the repo: put it there, or pass its path). The antd source the size table is checked against is read from ANTD_REF, which
//   defaults to D:/antd-ref. Both must exist, or the script stops before it writes anything.
// Then commit the snapshot; the studio reads it, never the token JSON.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTokenJson, buildBasePlan } from '../packages/builder-core/src/base-tokens/importer.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(here, '../packages/builder-core/src/base-tokens/base-snapshot.json');
const DEFAULT_TOKEN_JSON = resolve(here, '../packages/builder-core/src/base-tokens/source/token.json');
const ANTD_REF = process.env.ANTD_REF ?? 'D:/antd-ref';

const input = process.argv[2] ?? DEFAULT_TOKEN_JSON;
if (!existsSync(input)) {
    console.error(`Token JSON not found at "${input}".\n` +
        `Pass its path as the argument, or place the export at ${DEFAULT_TOKEN_JSON}.\n` +
        `The antd source expected at ${ANTD_REF} (set ANTD_REF to override).`);
    process.exit(1);
}
if (!existsSync(ANTD_REF)) {
    console.error(`antd source not found at "${ANTD_REF}".\n` +
        `Expected the antd-ref checkout at ${ANTD_REF} (set ANTD_REF to override); the size table is checked against it.\n` +
        `Token JSON: "${input}".`);
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
