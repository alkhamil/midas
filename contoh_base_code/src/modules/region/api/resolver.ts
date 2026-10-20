import {
  USE_MOCK,
  mockGetRegions,
  mockGetRegionById,
  mockCreateRegion,
  mockUpdateRegion,
  mockDeleteRegion,
  mockRestoreRegion,
  mockExportRegions,
  mockBulkUploadRegions,
  mockDownloadRegionTemplate,
  mockGetSelectOptions,
} from './mock';
import * as service from './service';

export const getRegions = USE_MOCK.list ? mockGetRegions : service.getRegions;
export const getRegionById = USE_MOCK.detail ? mockGetRegionById : service.getRegionById;
export const createRegion = USE_MOCK.create ? mockCreateRegion : service.createRegion;
export const updateRegion = USE_MOCK.update ? mockUpdateRegion : service.updateRegion;
export const deleteRegion = USE_MOCK.delete ? mockDeleteRegion : service.deleteRegion;
export const restoreRegion = USE_MOCK.restore ? mockRestoreRegion : service.restoreRegion;
export const exportRegions = USE_MOCK.export ? mockExportRegions : service.exportRegions;
export const bulkUploadRegions = USE_MOCK.bulkUpload ? mockBulkUploadRegions : service.bulkUploadRegions;
export const downloadRegionTemplate = USE_MOCK.bulkTemplate ? mockDownloadRegionTemplate : service.downloadRegionTemplate;
export const getSelectOptions = USE_MOCK.selectOptions ? mockGetSelectOptions : service.getSelectOptions;
