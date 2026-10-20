import type { TemplateContext } from './context';
import { needsQueriesFile } from '../templates/crud/api';

/** Daftar file (relatif terhadap folder modul) yang di-generate per kombinasi feature. */
export function getModuleFileList(ctx: TemplateContext): string[] {
  const { names, features } = ctx;
  const { entity } = names;
  const files = [
    'types/index.ts',
    'api/service.ts',
    'api/mock.ts',
    'api/resolver.ts',
    'api/index.ts',
    'hooks/index.ts',
    'components/index.ts',
    'permissions.ts',
    'index.ts',
    'INTEGRATION.md',
  ];
  const { list, detail, create, edit, bulkUpload, export: exportFeature } = features;
  const needForm = create || edit || detail;

  if (needsQueriesFile(ctx)) files.push('api/queries.ts');
  if (needForm || features.delete || bulkUpload) files.push('api/mutations.ts');
  if (list) {
    files.push(
      `hooks/use${entity}List.ts`,
      `hooks/use${entity}ListFilter.ts`,
      `components/${entity}Table.tsx`,
      `pages/${entity}ListPage.tsx`,
    );
  }
  if (detail) files.push(`pages/${entity}ViewPage.tsx`);
  if (create) files.push(`pages/${entity}CreatePage.tsx`);
  if (edit) files.push(`pages/${entity}EditPage.tsx`);
  if (needForm) {
    files.push(
      `hooks/use${entity}Form.tsx`,
      `components/${entity}Form.tsx`,
      `validation/${names.camel}Validation.ts`,
    );
  }
  if (exportFeature) files.push(`hooks/use${entity}Export.ts`);
  if (bulkUpload) {
    files.push(
      `components/${entity}BulkUploadDialog.tsx`,
      `validation/${names.camel}BulkValidation.ts`,
    );
  }

  return files.sort();
}
