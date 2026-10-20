/** Permission keys modul Region — base `region`, suffix otomatis. */
export const RegionPermissions = {
  view: 'region.view',
  create: 'region.create',
  update: 'region.update',
  delete: 'region.delete',
  bulkUpload: 'region.bulk_upload',
  export: 'region.export',
} as const;

export type RegionPermission =
  (typeof RegionPermissions)[keyof typeof RegionPermissions];
