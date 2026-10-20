/** Permission keys modul User — base `master-user`, suffix otomatis. */
export const UserPermissions = {
  view: 'master-user.view',
  create: 'master-user.create',
  update: 'master-user.update',
  delete: 'master-user.delete',
  bulkUpload: 'master-user.bulk_upload',
  export: 'master-user.export',
} as const;

export type UserPermission = (typeof UserPermissions)[keyof typeof UserPermissions];
