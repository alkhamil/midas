import { createRequire } from 'node:module';
import type { ModuleRegistration } from '../src/modules/generator/types.ts';

export const ROUTER_IMPORTS_ANCHOR = '// __GENERATOR_IMPORTS__';
export const ROUTER_ROUTES_ANCHOR = '// __GENERATOR_ROUTES__';
export const NAV_ITEMS_ANCHOR = '// __GENERATOR_NAV_ITEMS__';

export function parentMarker(parentPath: string): string {
  return `// __GENERATOR_PARENT ${parentPath}__`;
}

export interface RouteRegistrationOutcome {
  source: string;
  addedRoutes: number;
}

export interface NavRegistrationOutcome {
  source: string;
  added: boolean;
}

export interface UnregisterOutcome {
  source: string;
  removed: number;
}

/**
 * Hapus satu blok `{ ... }` (plus koma + satu newline) yang memuat token
 * pada posisi tokenIndex. Scan quote-aware untuk `{`/`}` agar aman dari
 * string berisi kurung kurawal. Return source utuh bila tidak cocok.
 */
function removeBraceBlockAt(source: string, tokenIndex: number): { source: string; removed: boolean } {
  const openIndex = source.lastIndexOf('{', tokenIndex);
  if (openIndex === -1) return { source, removed: false };
  let depth = 0;
  let quote: string | null = null;
  let closeIndex = -1;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i] as string;
    if (quote !== null) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        closeIndex = i;
        break;
      }
    }
  }
  if (closeIndex === -1) return { source, removed: false };
  // Token harus berada di dalam blok yang cocok (bukan blok dalam lain).
  if (tokenIndex > closeIndex) return { source, removed: false };
  let end = closeIndex + 1;
  if (source[end] === ',') end++;
  if (source[end] === '\n') end++;
  return { source: source.slice(0, openIndex) + source.slice(end), removed: true };
}

/** Hapus blok yang memuat token persis (dengan kutip penutup). */
function removeBlockContaining(source: string, token: string): { source: string; removed: boolean } {
  const tokenIndex = source.indexOf(token);
  if (tokenIndex === -1) return { source, removed: false };
  return removeBraceBlockAt(source, tokenIndex);
}

/**
 * Indeks `]` penutup array yang dibuka pada openIndex (harus menunjuk `[`).
 * Quote-aware seperti removeBraceBlockAt; -1 bila tak seimbang.
 */
function findMatchingBracket(source: string, openIndex: number): number {
  if (source[openIndex] !== '[') return -1;
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i] as string;
    if (quote !== null) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Indeks `[` pembuka array `children` grup parent mulai markerIndex; -1 bila tak ada. */
function findChildrenOpen(source: string, markerIndex: number): number {
  const match = /children\s*:\s*\[/.exec(source.slice(markerIndex));
  return match ? markerIndex + match.index + match[0].length - 1 : -1;
}

/**
 * Indeks `]` penutup array `children` (harus diikuti koma); -1 bila tak ada
 * penutup yang sah — mis. `]` milik array lain di bawahnya diabaikan.
 */
function findChildrenClose(source: string, childrenOpen: number): number {
  const closeIndex = findMatchingBracket(source, childrenOpen);
  if (closeIndex === -1 || source[closeIndex + 1] !== ',') return -1;
  return closeIndex;
}

function insertBeforeAnchor(source: string, anchor: string, block: string, file: string): string {
  const index = source.indexOf(anchor);
  if (index === -1) throw new Error(`Anchor ${anchor} tidak ditemukan di ${file}.`);
  // Sisip sebelum baris anchor; indent blok diselaraskan ke indent baris anchor.
  const lineStart = source.lastIndexOf('\n', index - 1) + 1;
  const anchorIndent = /^ */.exec(source.slice(lineStart, index))?.[0] ?? '';
  const lines = block.split('\n');
  const minIndent = lines
    .filter((line) => line.trim() !== '')
    .reduce((min, line) => Math.min(min, /^ */.exec(line)?.[0].length ?? 0), Infinity);
  const base = minIndent === Infinity ? 0 : minIndent;
  const aligned = lines
    .map((line) => (line.trim() === '' ? line : anchorIndent + line.slice(base)))
    .join('\n');
  return `${source.slice(0, lineStart)}${aligned}\n${source.slice(lineStart)}`;
}

/**
 * Sisipkan import + routes modul ke `router.tsx`. Idempoten: entri yang
 * path-nya sudah ada dilewati.
 */
export function registerModuleRoutes(
  source: string,
  reg: ModuleRegistration,
): RouteRegistrationOutcome {
  let next = source;
  let addedRoutes = 0;

  const newRoutes = reg.routes.filter((route) => !next.includes(`path: '${route.path}'`));
  if (newRoutes.length === 0) return { source, addedRoutes: 0 };

  if (reg.importBlock.trim() !== '' && !next.includes(`from '${reg.moduleImportPath}'`)) {
    next = insertBeforeAnchor(next, ROUTER_IMPORTS_ANCHOR, reg.importBlock, 'router.tsx');
  }
  next = insertBeforeAnchor(
    next,
    ROUTER_ROUTES_ANCHOR,
    newRoutes.map((route) => route.code).join('\n'),
    'router.tsx',
  );
  addedRoutes = newRoutes.length;
  return { source: next, addedRoutes };
}

/** Daftar nama ikon lucide bila pustaka bisa dimuat di Node; null = tak bisa dicek. */
function knownIconNames(): Set<string> | null {
  try {
    const require = createRequire(import.meta.url);
    const mod = require('lucide-react') as { icons?: Record<string, unknown> };
    if (!mod || typeof mod.icons !== 'object' || mod.icons === null) return null;
    return new Set(Object.keys(mod.icons));
  } catch {
    return null;
  }
}

/**
 * Ikon final untuk snippet nav: nama dari engine bila dikenal lucide,
 * `Database` bila tidak (engine sudah menjamin bentuk identifier aman).
 */
export function resolveNavIconName(iconName: string): string {
  if (!/^[A-Z][A-Za-z0-9]{0,39}$/.test(iconName)) return 'Database';
  const known = knownIconNames();
  if (known !== null && !known.has(iconName)) return 'Database';
  return iconName;
}

/** Pastikan `import { <name> }` dari lucide-react ada di `navigation.tsx` (terima single/double quote). */
export function ensureLucideImport(source: string, name: string): string {
  const importRe = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/;
  const match = importRe.exec(source);
  if (!match) return `import { ${name} } from 'lucide-react';\n${source}`;
  const members = match[1] as string;
  if (members.split(',').map((part) => part.trim()).includes(name)) return source;
  const updated = match[0].replace(/\{([^}]*)\}/, (_, inner: string) => {
    const trimmed = (inner as string).trim().replace(/,\s*$/, '');
    return `{ ${trimmed === '' ? name : `${trimmed}, ${name}`} }`;
  });
  return source.replace(match[0], updated);
}

/**
 * Sisipkan item nav modul ke `navigation.tsx`. Idempoten: dilewati bila
 * nav path sudah ada. Modul ber-parent masuk ke group marker parent
 * (dibuat bila belum ada).
 */
/**
 * Sinkronkan ikon menu saat modul di-publish ulang: item yang path-nya sudah
 * terdaftar tidak ditambah lagi, tapi ikonnya diganti mengikuti config
 * terbaru (item flat) atau ikon group parent-nya (item anak).
 */
export function syncExistingNavIcon(source: string, reg: ModuleRegistration): string {
  const icon = resolveNavIconName(reg.iconName);
  const pathToken = `path: '${reg.navPath}'`;
  const pathIndex = source.indexOf(pathToken);
  if (pathIndex === -1) return source;
  // Item flat: ikon berada di blok yang sama, setelah path.
  const itemEnd = source.indexOf('},', pathIndex);
  if (itemEnd !== -1) {
    const segment = source.slice(pathIndex, itemEnd);
    const iconMatch = /icon:\s*<([A-Za-z0-9]+)[^>]*\/>/.exec(segment);
    if (iconMatch) {
      if (iconMatch[1] === icon) return source;
      const next =
        source.slice(0, pathIndex) +
        segment.replace(iconMatch[0], `icon: <${icon} className="h-5 w-5" />`) +
        source.slice(itemEnd);
      return ensureLucideImport(next, icon);
    }
  }
  // Item anak dalam group parent: ikon milik group (sebelum path).
  const markerIndex = source.lastIndexOf('// __GENERATOR_PARENT', pathIndex);
  if (markerIndex !== -1) {
    const before = source.slice(markerIndex, pathIndex);
    const iconMatch = /icon:\s*<([A-Za-z0-9]+)[^>]*\/>/.exec(before);
    if (iconMatch && iconMatch[1] !== icon) {
      const next =
        source.slice(0, markerIndex) +
        before.replace(iconMatch[0], `icon: <${icon} className="h-5 w-5" />`) +
        source.slice(pathIndex);
      return ensureLucideImport(next, icon);
    }
  }
  return source;
}

/**
 * Hapus routes modul dari `router.tsx`: blok route per path + statement
 * import modul. Idempoten: path yang tidak ada dilewati.
 */
export function unregisterModuleRoutes(
  source: string,
  reg: ModuleRegistration,
): UnregisterOutcome {
  let next = source;
  let removed = 0;
  for (const route of reg.routes) {
    const out = removeBlockContaining(next, `path: '${route.path}'`);
    if (out.removed) {
      next = out.source;
      removed++;
    }
  }
  const importIndex = next.indexOf(`from '${reg.moduleImportPath}'`);
  if (importIndex !== -1) {
    const stmtStart = next.lastIndexOf('import', importIndex);
    const stmtEnd = next.indexOf(';', importIndex);
    if (stmtStart !== -1 && stmtEnd !== -1) {
      let end = stmtEnd + 1;
      if (next[end] === '\n') end++;
      next = next.slice(0, stmtStart) + next.slice(end);
    }
  }
  return { source: next, removed };
}

/**
 * Hapus item nav modul dari `navigation.tsx` (flat maupun anak grup).
 * Grup parent yang children-nya kosong ikut dihapus beserta markernya.
 * Idempoten: path yang tidak ada dilewati.
 */
export function unregisterModuleNav(
  source: string,
  reg: ModuleRegistration,
): UnregisterOutcome {
  if (reg.routes.length === 0) return { source, removed: 0 };
  const out = removeBlockContaining(source, `path: '${reg.navPath}'`);
  if (!out.removed) return { source, removed: 0 };
  let next = out.source;
  if (reg.parentPath) {
    const marker = parentMarker(reg.parentPath);
    const markerIndex = next.indexOf(marker);
    if (markerIndex !== -1) {
      const childrenOpen = findChildrenOpen(next, markerIndex);
      if (childrenOpen !== -1) {
        const childrenEnd = findChildrenClose(next, childrenOpen);
        const slice = childrenEnd === -1 ? '' : next.slice(childrenOpen, childrenEnd);
        if (childrenEnd !== -1 && !/\{/.test(slice)) {
          // Grup kosong: hapus baris marker + blok grup sampai penutupnya.
          const lineStart = next.lastIndexOf('\n', markerIndex - 1) + 1;
          const markerLineEnd = next.indexOf('\n', markerIndex) + 1;
          const groupOpen = next.indexOf('{', markerIndex);
          if (groupOpen !== -1 && markerLineEnd > lineStart) {
            const group = removeBraceBlockAt(next, groupOpen + 1);
            if (group.removed) {
              next = next.slice(0, lineStart) + group.source.slice(markerLineEnd);
            }
          }
        }
      }
    }
  }
  // Bersihkan import ikon modul bila tak dipakai lagi (hindari unused import).
  next = pruneLucideImport(next, resolveNavIconName(reg.iconName));
  return { source: next, removed: 1 };
}

/**
 * Hapus satu nama dari import lucide bila tak ada pemakaian JSX
 * (`<Nama .../>) tersisa; statement kosong ikut dibuang.
 */
export function pruneLucideImport(source: string, name: string): string {
  const importRe = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/;
  const match = importRe.exec(source);
  if (!match) return source;
  if (new RegExp(`<${name}(?=[\\s/>])`).test(source)) return source;
  const members = match[1].split(',').map((part) => part.trim()).filter(Boolean);
  const kept = members.filter((member) => member !== name);
  if (kept.length === members.length) return source;
  if (kept.length === 0) {
    const lineStart = source.lastIndexOf('\n', match.index - 1) + 1;
    let end = match.index + match[0].length;
    if (source[end] === ';') end++;
    if (source[end] === '\n') end++;
    return source.slice(0, lineStart) + source.slice(end);
  }
  return source.replace(match[0], match[0].replace(match[1], ` ${kept.join(', ')} `));
}

export function registerModuleNav(
  source: string,
  reg: ModuleRegistration,
): NavRegistrationOutcome {
  if (reg.routes.length === 0) return { source, added: false };
  if (source.includes(`path: '${reg.navPath}'`)) {
    return { source: syncExistingNavIcon(source, reg), added: false };
  }

  const icon = resolveNavIconName(reg.iconName);
  const withIcon = (code: string): string =>
    icon === reg.iconName
      ? code
      : code.split(`<${reg.iconName} className="h-5 w-5" />`).join(`<${icon} className="h-5 w-5" />`);

  if (!reg.parentPath) {
    const next = insertBeforeAnchor(source, NAV_ITEMS_ANCHOR, withIcon(reg.navItemCode), 'navigation.tsx');
    return { source: ensureLucideImport(next, icon), added: true };
  }

  const marker = parentMarker(reg.parentPath);
  const markerIndex = source.indexOf(marker);
  if (markerIndex !== -1) {
    const childrenOpen = findChildrenOpen(source, markerIndex);
    if (childrenOpen === -1) {
      throw new Error(`Blok ${marker} rusak (children tidak ditemukan).`);
    }
    const closeIndex = findChildrenClose(source, childrenOpen);
    if (closeIndex === -1) {
      throw new Error(`Blok ${marker} rusak (penutup children tidak ditemukan).`);
    }
    // Selaraskan indent item baru ke baris penutup (tahan formatter ulang).
    const closeLineStart = source.lastIndexOf('\n', closeIndex - 1) + 1;
    const closeIndent = /^ */.exec(source.slice(closeLineStart, closeIndex))?.[0] ?? '';
    const itemIndent = `${closeIndent}  `;
    const itemCode = reg.navItemCode
      .split('\n')
      .map((line) => (line.trim() === '' ? line : itemIndent + line.trimStart()))
      .join('\n');
    const next = `${source.slice(0, closeIndex)}\n${itemCode}${source.slice(closeIndex)}`;
    return { source: next, added: true };
  }

  const next = insertBeforeAnchor(source, NAV_ITEMS_ANCHOR, withIcon(reg.navSnippet), 'navigation.tsx');
  return { source: ensureLucideImport(next, icon), added: true };
}
