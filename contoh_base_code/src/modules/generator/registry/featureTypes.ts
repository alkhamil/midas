import type { FeatureKey } from '../types';

export interface FeatureDef {
  label: string;
  description: string;
  /** File kunci yang dihasilkan saat feature aktif (dokumentatif). */
  outputs: string[];
}

export const featureRegistry: Record<FeatureKey, FeatureDef> = {
  list: {
    label: 'List',
    description: 'List page + table + filter + pagination.',
    outputs: ['pages/XListPage', 'components/XTable', 'hooks/useXList+Filter'],
  },
  detail: {
    label: 'Detail',
    description: 'Read-only detail page.',
    outputs: ['pages/XViewPage'],
  },
  create: {
    label: 'Create',
    description: 'Data creation page.',
    outputs: ['pages/XCreatePage', 'components/XForm'],
  },
  edit: {
    label: 'Edit',
    description: 'Data edit page.',
    outputs: ['pages/XEditPage', 'components/XForm'],
  },
  delete: {
    label: 'Delete',
    description: 'Soft delete (deactivate) + restore from the list page.',
    outputs: ['mutations', 'dialogs'],
  },
  bulkUpload: {
    label: 'Bulk Upload',
    description: 'Excel (.xlsx) upload dialog + template download + per-row report.',
    outputs: ['components/XBulkUploadDialog', 'validation/xBulkValidation', 'mutations'],
  },
  export: {
    label: 'Export',
    description: 'Excel (.xlsx) download button honoring active filter, sort, and search.',
    outputs: ['hooks/useXExport'],
  },
};

export const featureKeys = Object.keys(featureRegistry) as FeatureKey[];
