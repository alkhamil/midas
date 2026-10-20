/** Dialog bulk upload generik — meniru dialog hasil generate. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  FileUploadField,
} from '../../../shared/components/ui';
import { downloadBlob, mapSubmitError } from '../../../shared/utils';
import type { ModuleDefinition } from '../definitions';
import { definitionTestId } from './types';
import { downloadTemplate } from './recordsApi';
import { bulkHeaders, type BulkUploadResult } from './bulk';
import { useBulkUploadDynamic } from './mutations';

interface DynamicBulkUploadDialogProps {
  def: ModuleDefinition;
  open: boolean;
  onClose: () => void;
}

function DynamicBulkUploadDialog({ def, open, onClose }: DynamicBulkUploadDialogProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | File[] | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bulkMutation = useBulkUploadDynamic(def);
  const testPrefix = definitionTestId(def.key);

  function reset(): void {
    setFile(null);
    setResult(null);
    setError(null);
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  async function handleDownloadTemplate(): Promise<void> {
    setLoadingTemplate(true);
    try {
      const blob = await downloadTemplate(def);
      downloadBlob(blob, `${testPrefix}-template.xlsx`);
    } catch (err: unknown) {
      const mapped = mapSubmitError(err, t('bulk.downloadFailed'));
      setError(mapped.toastMessage ?? t('bulk.downloadFailed'));
    } finally {
      setLoadingTemplate(false);
    }
  }

  async function handleUpload(): Promise<void> {
    const single = Array.isArray(file) ? file[0] : file;
    if (!single) {
      setError(t('bulk.pickFile'));
      return;
    }
    setError(null);
    try {
      const uploadResult = await bulkMutation.mutateAsync(single);
      setResult(uploadResult);
    } catch (err: unknown) {
      const mapped = mapSubmitError(err, t('bulk.uploadFailed'));
      setError(mapped.toastMessage ?? t('bulk.uploadFailed'));
    }
  }

  return (
    <Dialog
      testId={`${testPrefix}-bulk-upload-dialog`}
      open={open}
      onClose={handleClose}
      title={t('bulk.title', { singular: def.singularLabel })}
      maxWidth="lg"
      closeOnEscape
      closeOnBackdropClick
    >
      <div className="flex flex-col stack-gap">
        {error && <Alert variant="error" message={error} />}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={loadingTemplate}
          >
            {loadingTemplate ? t('bulk.downloading') : t('bulk.downloadTemplate')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('bulk.templateHint', { columns: bulkHeaders(def.fields).join(', ') })}
          </span>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">{t('bulk.fileUpload')}</label>
          <FileUploadField
            value={file}
            onChange={(next) => {
              setFile(next);
              setResult(null);
              setError(null);
            }}
            accept=".xlsx"
          />
        </div>
        {result && (
          <div className="flex flex-col field-gap">
            <Alert
              variant={result.failedCount === 0 ? 'success' : 'warning'}
              message={t('bulk.result', { success: result.successCount, failed: result.failedCount, total: result.totalRows })}
            />
            {result.errors.length > 0 && (
              <ul className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                {result.errors.map((item, index) => (
                  <li key={`${item.row}-${item.field ?? ''}-${index}`} className="py-0.5">
                    <span className="font-mono">{t('bulk.row', { row: item.row })}</span>
                    {item.field ? <span className="font-mono"> [{item.field}]</span> : null}:{' '}
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t('common.close')}
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={bulkMutation.isPending || !file}
          >
            {bulkMutation.isPending ? t('bulk.uploading') : t('bulk.upload')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export default DynamicBulkUploadDialog;
