import type { TemplateContext } from '../../engine/context';

export function permissionsTemplate(ctx: TemplateContext): string {
  const { names, permissions } = ctx;
  return `/** Permission keys modul ${names.entity} — base \`${permissions.base}\`, suffix otomatis. */
export const ${names.entity}Permissions = {
  view: '${permissions.view}',
  create: '${permissions.create}',
  update: '${permissions.update}',
  delete: '${permissions.delete}',
  bulkUpload: '${permissions.bulkUpload}',
  export: '${permissions.export}',
} as const;

export type ${names.entity}Permission =
  (typeof ${names.entity}Permissions)[keyof typeof ${names.entity}Permissions];
`;
}
