// Code Builder generator (spec §6): project config + screen trees → React/TypeScript source files for the base project.
// Pure (no I/O) so it runs in Studio (zip download) and in the CLI (`midas generate`).
//
// Result: { files: { 'src/…': content }, warnings: [] } — modules under `src/modules/<path>` plus
// `src/app/generated/*` (routes, menu, locales, layout, page meta) imported by the base project, so regenerating is
// safe: generated files never mix with hand-written code.
import { breadcrumbsOf, pageTitle, pascalCase, resolveLayout, screenPath } from '../model.js';
import { CRUD_ROLES, camelCase, screenTree } from '../screen.js';
import { apiFiles, typesFile } from './api.js';
import { pageFile } from './page.js';
import { GEN_HEADER, iconComponent, moduleDir, q } from './util.js';

export { dialogTexts, pageNameOf } from './page.js';

export function generateProject(project, trees) {
    const { modules } = project.config;
    const files = {}, warnings = [];
    const gctx = { modules, trees };
    const locales = {}; // module name → folder
    const imports = [], routes = [], pages = [];
    const layout = resolveLayout(project.config);

    for (const mod of modules) {
        const real = mod.screens.filter(s => s.role !== 'dialog');
        if (!real.length) { warnings.push(`Module ${mod.name} skipped: it has no screens yet`); continue; }
        const dir = moduleDir(modules, mod);
        const base = `src/modules/${dir}/`;
        const sharedRel = '../'.repeat(dir.split('/').length + 2);
        const crud = real.some(s => CRUD_ROLES.includes(s.role));
        if (crud && !mod.entity?.fields?.length) { warnings.push(`Module ${mod.name} skipped: CRUD without entity fields`); continue; }
        const E = pascalCase(mod.name);
        const pageExports = [], localeEn = {};
        const used = new Set();
        if (crud) {
            files[`${base}types/index.ts`] = typesFile(mod);
            for (const [p, c] of Object.entries(apiFiles(mod, sharedRel))) files[base + p] = c;
            files[`${base}api/index.ts`] = `${GEN_HEADER}export * from './queries';\n`;
        }
        const ns = mod.name.replace(/-/g, '_');
        for (const s of real) {
            const t = trees.get(s.id)?.tree;
            if (!t) { warnings.push(`Screen ${s.name} skipped: frame not found`); continue; }
            const page = pageFile(gctx, mod, s, t);
            let name = page.name;
            while (used.has(name)) name += '2';
            used.add(name);
            files[`${base}pages/${name}.tsx`] = page.code;
            localeEn[page.key] = page.locale;
            pageExports.push({ name, screen: s });
        }
        const json = JSON.stringify({ [ns]: localeEn }, null, 2) + '\n';
        files[`${base}i18n/en.json`] = json;
        files[`${base}i18n/id.json`] = json;
        files[`${base}index.ts`] = `${GEN_HEADER}${pageExports.map(p => `export { default as ${p.name} } from './pages/${p.name}';`).join('\n')}\n`;
        locales[mod.name] = dir;
        if (pageExports.length) imports.push(`import * as ${E}Module from '../../modules/${dir}';`);
        for (const p of pageExports) {
            pages.push(`  { path: ${q(screenPath(modules, mod, p.screen))}, title: ${q(pageTitle(mod, p.screen))}, breadcrumbs: ${JSON.stringify(breadcrumbsOf(modules, mod, p.screen)).replace(/"/g, "'")} },`);
            const route = screenPath(modules, mod, p.screen).slice(1);
            routes.push(route ? `  { path: ${q(route)}, element: <${E}Module.${p.name} /> },` : `  { index: true, element: <${E}Module.${p.name} /> },`);
        }
    }

    const localeImports = Object.values(locales).flatMap((dir, i) => [
        `import en${i} from '../../modules/${dir}/i18n/en.json';`, `import id${i} from '../../modules/${dir}/i18n/id.json';`,
    ]);
    const n = Object.keys(locales).length;
    files['src/app/generated/locales.ts'] = `${GEN_HEADER}${localeImports.join('\n')}${n ? '\n\n' : ''}export const generatedLocales = {\n  en: [${Array.from({ length: n }, (_, i) => `en${i}`).join(', ')}],\n  id: [${Array.from({ length: n }, (_, i) => `id${i}`).join(', ')}],\n};\n`;
    // The base project's built-in home page is used when no generated `dashboard` module exists.
    const ownHome = routes.some(r => r.includes('index: true'));
    if (!ownHome) {
        imports.unshift("import { DashboardPage } from '../../modules/dashboard';");
        routes.unshift('  { index: true, element: <DashboardPage /> },');
    }
    files['src/app/generated/routes.tsx'] = `${GEN_HEADER}import type { RouteObject } from 'react-router';\n${imports.join('\n')}\n\nexport const generatedRoutes: RouteObject[] = [\n${routes.join('\n')}\n];\n`;
    const iconNames = [...new Set(layout.items.map(i => iconComponent(i.icon)))];
    const navItems = layout.items.filter(i => !i.hidden).map(i => `  { label: ${q(i.label)}, path: ${q(i.path)}, icon: <${iconComponent(i.icon)} className="h-5 w-5" />, permissionKey: ${q(i.permissionKey)} },`);
    if (!ownHome) {
        iconNames.unshift('WidgetIcon');
        navItems.unshift("  { label: 'Dashboard', labelKey: 'nav.dashboard', path: '/', icon: <WidgetIcon className=\"h-5 w-5\" /> },");
    }
    files['src/app/generated/navigation.tsx'] = `${GEN_HEADER}${iconNames.length ? `import { ${[...new Set(iconNames)].join(', ')} } from '@midas/ui-cms';\n` : ''}import type { NavItemType } from '../../shared/types/navigation';\n\nexport const generatedNavItems: NavItemType[] = [\n${navItems.join('\n')}\n];\n`;
    files['src/app/generated/pages.ts'] = `${GEN_HEADER}export interface PageMeta {\n  path: string;\n  title: string;\n  breadcrumbs: { label: string; path?: string }[];\n}\n\n/** Topbar title & breadcrumbs per route (react-router path patterns). */\nexport const generatedPages: PageMeta[] = [\n${pages.join('\n')}\n];\n`;
    files['src/app/generated/layout.ts'] = `${GEN_HEADER}export const appLayout = { appName: ${q(layout.appName)} };\n`;
    return { files, warnings, layout };
}

/** Screen trees of every screen of the project (with per-node config overrides) from a document context. */
export function buildTrees(config, ctx) {
    return new Map(config.modules.flatMap(m => m.screens.map(s => [s.id, screenTree(ctx, s.frameId, s.nodes || {})])));
}
export { assembleProject } from './project.js';
