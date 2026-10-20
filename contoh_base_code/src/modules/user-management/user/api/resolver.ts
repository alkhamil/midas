import {
  USE_MOCK,
  mockGetUsers,
  mockGetUserById,
  mockCreateUser,
  mockUpdateUser,
  mockDeleteUser,
  mockRestoreUser,
  mockGetRoleOptions,
  mockExportUsers,
  mockBulkUploadUsers,
  mockDownloadUserTemplate,
} from './mock';
import * as service from './service';

export const getUsers = USE_MOCK.list ? mockGetUsers : service.getUsers;
export const getUserById = USE_MOCK.detail ? mockGetUserById : service.getUserById;
export const createUser = USE_MOCK.create ? mockCreateUser : service.createUser;
export const updateUser = USE_MOCK.update ? mockUpdateUser : service.updateUser;
export const deleteUser = USE_MOCK.delete ? mockDeleteUser : service.deleteUser;
export const restoreUser = USE_MOCK.restore ? mockRestoreUser : service.restoreUser;
export const getRoleOptions = USE_MOCK.roleOptions ? mockGetRoleOptions : service.getRoleOptions;
export const exportUsers = USE_MOCK.export ? mockExportUsers : service.exportUsers;
export const bulkUploadUsers = USE_MOCK.bulkUpload ? mockBulkUploadUsers : service.bulkUploadUsers;
export const downloadUserTemplate = USE_MOCK.bulkTemplate
  ? mockDownloadUserTemplate
  : service.downloadUserTemplate;
