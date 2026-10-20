import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../shared/components/ui';
import { downloadBlob, mapSubmitError } from '../../../../shared/utils';
import type { GetRolesParams } from '../types';
import { exportRoles } from '../api';

export function useRoleExport() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isExporting, setExporting] = useState(false);

  async function exportData(params: GetRolesParams): Promise<void> {
    setExporting(true);
    try {
      const blob = await exportRoles(params);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `role-${stamp}.xlsx`);
      showToast({ variant: 'success', message: t('runtime.exportDone') });
    } catch (err: unknown) {
      const fallback = t('runtime.exportFailed');
      const result = mapSubmitError(err, fallback);
      showToast({ message: result.toastMessage ?? fallback, variant: 'error' });
    } finally {
      setExporting(false);
    }
  }

  return { exportData, isExporting };
}
