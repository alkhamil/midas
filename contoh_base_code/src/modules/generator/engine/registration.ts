import type { GeneratorConfig, ModuleRegistration, RegistrationRoute } from '../types';
import { MENU_ICON_NAME_RE } from '../types';
import { normalizeConfig } from '../parser';
import { buildContext } from './context';
import { normalizeParentPath, prettifyParent } from '../naming';

export function buildRegistration(raw: GeneratorConfig): ModuleRegistration {
  const config = normalizeConfig(raw);
  const ctx = buildContext(config);
  const { names, features, permissions } = ctx;
  const base = config.permissionKey;
  const label = names.entityPlural;
  const listPath = `/${names.routeBase}`;
  const parentPath = normalizeParentPath(config.parentName);
  const parentLabel = parentPath ? prettifyParent(parentPath) : null;
  const rawIcon = config.menuIcon?.name.trim() ?? '';
  const iconName = MENU_ICON_NAME_RE.test(rawIcon) ? rawIcon : 'Database';

  const pages: { page: string; route: string; crumb: string; permission: string }[] = [];
  if (features.list) {
    pages.push({
      page: `${names.entity}ListPage`,
      route: names.routeBase,
      crumb: 'list',
      permission: permissions.view,
    });
  }
  if (features.create) {
    pages.push({
      page: `${names.entity}CreatePage`,
      route: `${names.routeBase}/create`,
      crumb: 'Create',
      permission: permissions.create,
    });
  }
  if (features.detail) {
    pages.push({
      page: `${names.entity}ViewPage`,
      route: `${names.routeBase}/:${names.paramId}/view`,
      crumb: 'Detail',
      permission: permissions.view,
    });
  }
  if (features.edit) {
    pages.push({
      page: `${names.entity}EditPage`,
      route: `${names.routeBase}/:${names.paramId}/edit`,
      crumb: 'Edit',
      permission: permissions.update,
    });
  }

  const moduleImportPath = `../${names.dir.replace(/^src\//, '').replace(/\/$/, '')}`;
  const importBlock =
    pages.length === 0
      ? ''
      : `import {\n${pages.map((p) => `  ${p.page},`).join('\n')}\n} from '${moduleImportPath}';`;

  const crumbKey = (crumb: string): string =>
    crumb === 'list' ? 'list' : crumb.toLowerCase();
  const routes: RegistrationRoute[] = pages.map((p) => {
    const breadcrumb =
      p.crumb === 'list'
        ? `[{ label: '${label}', labelKey: '${base}.breadcrumbs.list' }]`
        : `[{ label: '${label}', labelKey: '${base}.breadcrumbs.list', path: '${listPath}' }, { label: '${p.crumb}', labelKey: '${base}.breadcrumbs.${crumbKey(p.crumb)}' }]`;
    return {
      path: p.route,
      code:
        `      {\n` +
        `        path: '${p.route}',\n` +
        `        element: <${p.page} />,\n` +
        `        handle: {\n` +
        `          breadcrumb: ${breadcrumb},\n` +
        `          requiredPermission: '${p.permission}',\n` +
        `        },\n` +
        `      },`,
    };
  });

  const flatItemCode =
    `  {\n` +
    `    label: '${label}',\n` +
    `    labelKey: '${base}.labelPlural',\n` +
    `    path: '${listPath}',\n` +
    `    icon: <${iconName} className="h-5 w-5" />,\n` +
    `    permissionKey: '${permissions.view}',\n` +
    `  },`;
  const childItemCode =
    `      { label: '${label}', labelKey: '${base}.labelPlural', path: '${listPath}', permissionKey: '${permissions.view}' },`;
  const navItemCode = parentPath ? childItemCode : flatItemCode;
  const navSnippet = parentPath
    ? `  // __GENERATOR_PARENT ${parentPath}__\n` +
      `  {\n` +
      `    label: '${parentLabel}',\n` +
      `    labelKey: '${base}.parentLabel',\n` +
      `    icon: <${iconName} className="h-5 w-5" />,\n` +
      `    children: [\n` +
      `${childItemCode}\n` +
      `    ],\n` +
      `  },`
    : flatItemCode;

  return {
    moduleImportPath,
    importBlock,
    routes,
    navPath: listPath,
    navItemCode,
    navSnippet,
    parentPath,
    parentLabel,
    label,
    iconName,
    permissionView: permissions.view,
  };
}
