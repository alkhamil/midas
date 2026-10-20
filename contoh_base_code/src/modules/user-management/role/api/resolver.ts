import {
  USE_MOCK,
  mockGetRoles,
  mockGetRoleById,
  mockCreateRole,
  mockUpdateRole,
  mockDeleteRole,
  mockGetPermissions,
  mockRestoreRole,
  mockExportRoles,
  mockBulkUploadRoles,
  mockDownloadRoleTemplate,
} from './mock';
import * as service from './service';

export const getRoles = USE_MOCK.list ? mockGetRoles : service.getRoles;
export const getRoleById = USE_MOCK.detail ? mockGetRoleById : service.getRoleById;
export const createRole = USE_MOCK.create ? mockCreateRole : service.createRole;
export const updateRole = USE_MOCK.update ? mockUpdateRole : service.updateRole;
export const deleteRole = USE_MOCK.delete ? mockDeleteRole : service.deleteRole;
export const getPermissions = USE_MOCK.permissions ? mockGetPermissions : service.getPermissions;
export const restoreRole = USE_MOCK.restore ? mockRestoreRole : service.restoreRole;
export const exportRoles = USE_MOCK.export ? mockExportRoles : service.exportRoles;
export const bulkUploadRoles = USE_MOCK.bulkUpload ? mockBulkUploadRoles : service.bulkUploadRoles;
export const downloadRoleTemplate = USE_MOCK.bulkTemplate
  ? mockDownloadRoleTemplate
  : service.downloadRoleTemplate;
