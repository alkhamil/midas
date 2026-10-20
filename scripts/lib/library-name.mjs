// Where the seed scripts get the library package name from: nothing is written in the scripts themselves.
//   1. --package <name>
//   2. the library the file already published as (its name is locked after the first publish)
//   3. the name in the code package folder (packages/ui-cms/package.json)
//   4. a name derived from the file name, like the Publish dialog proposes (@midas/ui-<file-name-slug>)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const slug = s => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'library';

export const packageFromFileName = fileName => `@midas/ui-${slug(fileName)}`;

/** package.json of the code package folder: { name, version } or null. */
export function readCodePackage(dir) {
    try {
        const { name, version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        return name ? { name, version } : null;
    } catch {
        return null;
    }
}

/** Libraries of the signed-in workspace; the library id equals the id of its design file. */
export async function listLibraries(api) {
    return (await api('GET', '/api/libraries')).libraries || [];
}

export function pickPackageName({ arg, published, codePackage, fileName }) {
    if (typeof arg === 'string' && arg) return { name: arg, from: '--package' };
    if (published?.packageName) return { name: published.packageName, from: 'the published library' };
    if (codePackage?.name) return { name: codePackage.name, from: 'the code package' };
    return { name: packageFromFileName(fileName), from: 'the file name' };
}

/** Next version for a bump: major | minor | patch. */
export function bumpVersion(version, part) {
    const [M, m, p] = String(version).split('.').map(Number);
    if (![M, m, p].every(Number.isFinite)) throw new Error(`cannot bump version "${version}"`);
    return part === 'major' ? `${M + 1}.0.0` : part === 'minor' ? `${M}.${m + 1}.0` : `${M}.${m}.${p + 1}`;
}

/** Comma separated option → lowercase set, or null when the option is absent. */
export function listArg(value) {
    return typeof value === 'string' ? new Set(value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) : null;
}
