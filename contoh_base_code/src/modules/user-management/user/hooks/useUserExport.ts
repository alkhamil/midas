import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../shared/components/ui';
import { downloadBlob, mapSubmitError } from '../../../../shared/utils';
import type { GetUsersParams } from '../types';
import { exportUsers } from '../api';

export function useUserExport() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isExporting, setExporting] = useState(false);

  async function exportData(params: GetUsersParams): Promise<void> {
    setExporting(true);
    try {
      const blob = await exportUsers(params);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `user-${stamp}.xlsx`);
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
