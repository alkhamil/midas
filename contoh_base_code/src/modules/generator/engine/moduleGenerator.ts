import type { GeneratedFile, GeneratorConfig } from '../types';
import { normalizeConfig, validateConfig, type ConfigIssue } from '../parser';
import { buildContext } from './context';
import { typesTemplate } from '../templates/crud/types';
import {
  mockTemplate,
  serviceTemplate,
  resolverTemplate,
  queriesTemplate,
  mutationsTemplate,
  apiIndexTemplate,
  needsQueriesFile,
} from '../templates/crud/api';
import {
  listHookTemplate,
  listFilterHookTemplate,
  formHookTemplate,
  exportHookTemplate,
  hooksIndexTemplate,
} from '../templates/crud/hooks';
import {
  tableTemplate,
  formTemplate,
  bulkDialogTemplate,
  componentsIndexTemplate,
} from '../templates/crud/components';
import {
  listPageTemplate,
  createPageTemplate,
  viewPageTemplate,
  editPageTemplate,
} from '../templates/crud/pages';
import { bulkValidationTemplate, validationTemplate } from '../templates/crud/validation';
import { permissionsTemplate } from '../templates/crud/permissions';
import { moduleIndexTemplate, integrationTemplate } from '../templates/crud/moduleIndex';
import { buildModuleLocales, mergeLocales, unflattenLocale } from './i18nGenerator';

export class GeneratorConfigError extends Error {
  issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super(`Invalid generator config: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
    this.name = 'GeneratorConfigError';
    this.issues = issues;
  }
}

/** Generate seluruh file modul dari konfigurasi. Pure: config → file list. */
export function generateModule(raw: GeneratorConfig): GeneratedFile[] {
  const config = normalizeConfig(raw);
  const issues = validateConfig(config);
  if (issues.length > 0) throw new GeneratorConfigError(issues);
  const ctx = buildContext(config);
  const { names, features } = ctx;

  const files: GeneratedFile[] = [];
  const push = (rel: string, content: string): void => {
    files.push({ path: `${names.dir}${rel}`, content });
  };
  const needForm = features.create || features.edit || features.detail;
  const needMutations = needForm || features.delete || features.bulkUpload;

  push('types/index.ts', typesTemplate(ctx));
  push('api/mock.ts', mockTemplate(ctx));
  push('api/service.ts', serviceTemplate(ctx));
  push('api/resolver.ts', resolverTemplate(ctx));
  if (needsQueriesFile(ctx)) push('api/queries.ts', queriesTemplate(ctx));
  if (needMutations) push('api/mutations.ts', mutationsTemplate(ctx));
  push('api/index.ts', apiIndexTemplate(ctx));

  if (features.list) {
    push(`hooks/use${names.entity}List.ts`, listHookTemplate(ctx));
    push(`hooks/use${names.entity}ListFilter.ts`, listFilterHookTemplate(ctx));
    push(`components/${names.entity}Table.tsx`, tableTemplate(ctx));
    push(`pages/${names.entity}ListPage.tsx`, listPageTemplate(ctx));
  }
  if (features.export) {
    push(`hooks/use${names.entity}Export.ts`, exportHookTemplate(ctx));
  }
  if (features.bulkUpload) {
    push(`components/${names.entity}BulkUploadDialog.tsx`, bulkDialogTemplate(ctx));
    push(`validation/${names.camel}BulkValidation.ts`, bulkValidationTemplate(ctx));
  }
  if (features.detail) push(`pages/${names.entity}ViewPage.tsx`, viewPageTemplate(ctx));
  if (features.create) push(`pages/${names.entity}CreatePage.tsx`, createPageTemplate(ctx));
  if (features.edit) push(`pages/${names.entity}EditPage.tsx`, editPageTemplate(ctx));
  if (needForm) {
    push(`hooks/use${names.entity}Form.tsx`, formHookTemplate(ctx));
    push(`components/${names.entity}Form.tsx`, formTemplate(ctx));
    push(`validation/${names.camel}Validation.ts`, validationTemplate(ctx));
  }

  push('hooks/index.ts', hooksIndexTemplate(ctx));
  push('components/index.ts', componentsIndexTemplate(ctx));
  push('permissions.ts', permissionsTemplate(ctx));
  push('index.ts', moduleIndexTemplate(ctx));
  push('INTEGRATION.md', integrationTemplate(ctx));

  // Locale modul: `en.json` sumber kebenaran; `id.json` = en yang ditimpa
  // terjemahan dari step Translation (`config.i18n.id`, key dot `"<base>..."`).
  // Tanpa terjemahan, id = salinan en (placeholder).
  const locales = buildModuleLocales(config);
  const translatedId: Record<string, string> = {};
  for (const [key, value] of Object.entries(config.i18n?.id ?? {})) {
    if (key === locales.base || key.startsWith(`${locales.base}.`)) translatedId[key] = value;
  }
  const idLocales = mergeLocales(locales.en, unflattenLocale(translatedId));
  // Tanpa newline akhir — samakan gaya locale JSON repo ini.
  push('i18n/en.json', JSON.stringify(locales.en, null, 2));
  push('i18n/id.json', JSON.stringify(idLocales, null, 2));

  return files.sort((a, b) => a.path.localeCompare(b.path));
}
