/** Permission keys modul Role — base `master-role`, suffix otomatis. */
export const RolePermissions = {
  view: 'master-role.view',
  create: 'master-role.create',
  update: 'master-role.update',
  delete: 'master-role.delete',
  bulkUpload: 'master-role.bulk_upload',
  export: 'master-role.export',
} as const;

export type RolePermissionKey = (typeof RolePermissions)[keyof typeof RolePermissions];
