import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Dialog, Table, useToast } from '../../../shared/components/ui';
import { Trash2 } from 'lucide-react';
import type { ModuleDefinition } from '../definitions';
import { relationDependentsOf } from '../definitions';
import { deleteDefinition, deleteModuleRecords } from '../runtime';
import { deleteModuleFromRepo } from '../api/deleteFromRepo';
import { WriteEndpointUnavailableError } from '../api/writeToRepo';
import { clearDraft, isDraftOfModule, loadDraft } from '../builder/draft';
import GenerateDialog from './GenerateDialog';

interface ModulesTabProps {
  definitions: ModuleDefinition[];
  isLoading: boolean;
  onEdit: (def: ModuleDefinition) => void;
  /** Dipanggil setelah definisi + records terhapus (mis. reset wizard yang sedang mengeditnya). */
  onDeleted?: (def: ModuleDefinition) => void;
}

function ModulesTab({ definitions, isLoading, onEdit, onDeleted }: ModulesTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ModuleDefinition | null>(null);
  const [generateTarget, setGenerateTarget] = useState<ModuleDefinition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /** Modul yang bergantung (relasi) ke target hapus — ikut terhapus cascade,
   * diurutkan import-terdalam dulu agar folder repo dihapus dari importer ke target. */
  const deleteCascade = deleteTarget
    ? [...relationDependentsOf(deleteTarget.key, definitions)].reverse()
    : [];

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const toDelete = [...deleteCascade, deleteTarget];
    try {
      let repoCount = 0;
      for (const def of toDelete) {
        await deleteDefinition(def.key);
        await deleteModuleRecords(def.apiPlural);
        // Best-effort: hapus juga file repo hasil generate (hanya ada di dev-server).
        try {
          const repo = await deleteModuleFromRepo(def);
          repoCount += repo.deleted.length + repo.removedRoutes + (repo.removedNav ? 1 : 0);
        } catch (err) {
          if (!(err instanceof WriteEndpointUnavailableError)) {
            showToast({
              variant: 'warning',
              message: t('modules.repoDeleteFailed', {
                message: err instanceof Error ? err.message : t('modules.deleteFailed'),
              }),
            });
          }
        }
        // Draft milik modul yang dihapus ikut dibersihkan agar tak termuat lagi.
        if (isDraftOfModule(loadDraft(), def)) clearDraft();
        onDeleted?.(def);
      }
      await queryClient.invalidateQueries({ queryKey: ['dynamic-definitions'] });
      await queryClient.invalidateQueries({ queryKey: ['dynamic-definition'] });
      await queryClient.invalidateQueries({ queryKey: ['dynamic-records'] });
      await queryClient.invalidateQueries({ queryKey: ['dynamic-record'] });
      showToast({
        variant: 'success',
        message:
          deleteCascade.length > 0
            ? t('modules.deletedCascade', { key: deleteTarget.key, count: deleteCascade.length })
            : t('modules.deleted', { key: deleteTarget.key }),
      });
      if (repoCount > 0) {
        showToast({
          variant: 'success',
          message: t('modules.repoDeleted', { key: deleteTarget.key, count: repoCount }),
        });
      }
      setDeleteTarget(null);
    } catch (err) {
      showToast({
        variant: 'error',
        message: err instanceof Error ? err.message : t('modules.deleteFailed'),
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const sorted = [...definitions].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex flex-col stack-gap">
      <p className="text-sm text-muted-foreground">
        {t('modules.intro', { count: definitions.length })}
      </p>
      <Table<ModuleDefinition>
        testId="modules-table"
        rowKey={(def) => def.key}
        columns={[
          {
            key: 'label',
            header: t('modules.colModule'),
            render: (def) => (
              <span>
                <span className="font-medium text-foreground">{def.label}</span>{' '}
                <span className="font-mono text-xs text-muted-foreground">{def.key}</span>
              </span>
            ),
          },
          {
            key: 'parent',
            header: t('modules.colParent'),
            render: (def) => (
              <span className="font-mono text-xs text-foreground">{def.parent ?? '(root)'}</span>
            ),
          },
          {
            key: 'status',
            header: t('modules.colStatus'),
            sortable: false,
            render: (def) => (
              <Badge variant={def.status === 'published' ? 'success' : 'secondary'}>
                {def.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            ),
          },
          {
            key: 'fields',
            header: t('modules.colFields'),
            sortable: false,
            render: (def) => (
              <span className="text-foreground">{t('modules.fieldsCount', { count: def.fields.length })}</span>
            ),
          },
        ]}
        data={sorted}
        totalRecords={sorted.length}
        page={1}
        pageSize={sorted.length === 0 ? 10 : sorted.length}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        hidePagination
        loading={isLoading}
        isEmptyState={!isLoading && sorted.length === 0}
        emptyStateTitle={t('modules.emptyTitle')}
        emptyStateDescription={t('modules.emptyDesc')}
        renderAction={(def) => (
          <div className="flex flex-wrap justify-end gap-1">
            <Button size="sm" variant="secondary" onClick={() => onEdit(def)}>
              {t('common.edit')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setGenerateTarget(def)}>
              {t('modules.generate')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => setDeleteTarget(def)} icon={<Trash2 className="h-4 w-4" />}>
              {t('common.delete')}
            </Button>
          </div>
        )}
      />
      <Dialog
        testId="modules-delete-dialog"
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('modules.deleteTitle')}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" disabled={isDeleting} onClick={() => void handleDelete()} icon={<Trash2 className="h-4 w-4" />}>
              {isDeleting ? t('modules.deleting') : t('modules.deleteModule')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col stack-gap">
          <p className="text-sm text-foreground">
            {t('modules.deleteConfirm', { label: deleteTarget?.label ?? '', key: deleteTarget?.key ?? '' })}
          </p>
          {deleteCascade.length > 0 && (
            <div className="flex flex-col field-gap" data-testid="modules-delete-cascade">
              <p className="text-sm font-medium text-danger">
                {t('modules.deleteCascadeWarning', {
                  key: deleteTarget?.key ?? '',
                  count: deleteCascade.length,
                })}
              </p>
              <ul className="flex flex-col field-gap">
                {deleteCascade.map((def) => (
                  <li key={def.key} className="text-sm text-foreground">
                    <span className="font-medium">{def.label}</span>{' '}
                    <span className="font-mono text-xs text-muted-foreground">{def.key}</span>{' '}
                    <Badge variant={def.status === 'published' ? 'success' : 'secondary'}>
                      {def.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
      {generateTarget && (
        <GenerateDialog def={generateTarget} onClose={() => setGenerateTarget(null)} />
      )}
    </div>
  );
}

export default ModulesTab;
