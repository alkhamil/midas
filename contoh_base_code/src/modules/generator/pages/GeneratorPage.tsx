import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Dialog, useToast } from '../../../shared/components/ui';
import { downloadBlob } from '../../../shared/utils';
import { ChevronLeft, ChevronRight, Check, CircleDot, Circle } from 'lucide-react';
import type { FeatureKey, GeneratorConfig, GeneratorFieldConfig, MenuIcon } from '../types';
import { normalizeModuleName } from '../parser';
import type { DeleteMode, ModuleDefinition, ModuleLayout } from '../definitions';
import type { ModuleI18nDict } from '../types';
import {
  NEW_PARENT_VALUE,
  buildApiContract,
  configToDefinition,
  defaultLayoutForFields,
  normalizeLayout,
  parentOptionsFromDefinitions,
  validateDefinition,
} from '../definitions';
import {
  deleteDefinition,
  deleteModuleRecords,
  saveDefinition,
  useDynamicDefinitions,
} from '../runtime';
import type { DynamicListItem } from '../runtime/types';
import type { DynamicFormValues } from '../runtime/validation';
import ModuleInfoStep, {
  resolveEffectiveParent,
  type ModuleInfoValue,
} from '../components/ModuleInfoStep';
import FeaturesStep from '../components/FeaturesStep';
import IconPickerDialog from '../components/IconPickerDialog';
import ModulesTab from '../components/ModulesTab';
import ReviewStep from '../components/ReviewStep';
import TranslationStep from '../components/TranslationStep';
import FormBuilderCanvas from '../builder/FormBuilderCanvas';
import TestDataPanel from '../builder/TestDataPanel';
import ListBuilderCanvas from '../builder/ListBuilderCanvas';
import DetailBuilderCanvas from '../builder/DetailBuilderCanvas';
import ContractPanel from '../builder/ContractPanel';
import { clearDraft, loadDraft, saveDraft, valuesToSampleRow } from '../builder/draft';
import { publishModuleToRepo } from '../api/publishToRepo';

const STEPS = [
  'config',
  'formCanvas',
  'livePreview',
  'listCanvas',
  'detailCanvas',
  'translation',
  'review',
] as const;

const DEFAULT_FEATURES: Record<FeatureKey, boolean> = {
  list: true,
  detail: true,
  create: true,
  edit: true,
  delete: true,
  bulkUpload: true,
  export: true,
};

function StepIndicator({ step }: { step: number }) {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((key, index) => {
        const state = index < step ? 'done' : index === step ? 'current' : 'todo';
        const label = t(`wizard.steps.${key}`);
        return (
          <li key={key} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-6 bg-border" />}
            {state === 'done' ? (
              <Check className="h-7 w-7 text-success" />
            ) : state === 'current' ? (
              <CircleDot className="h-7 w-7 text-primary" />
            ) : (
              <Circle className="h-7 w-7 text-muted-foreground" />
            )}
            <span
              className={`text-sm ${state === 'current' ? 'font-semibold text-foreground' : state === 'done' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const INITIAL_INFO: ModuleInfoValue = {
  parentName: '',
  newParentName: '',
  moduleName: '',
  type: 'crud',
  permissionKey: '',
};

interface PublishResult {
  definition: ModuleDefinition;
  created: boolean;
}

function GeneratorPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [initialDraft] = useState(loadDraft);
  const [step, setStep] = useState(() =>
    Math.min(initialDraft?.step ?? 0, STEPS.length - 1),
  );
  const [info, setInfo] = useState<ModuleInfoValue>(initialDraft?.info ?? INITIAL_INFO);
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(
    initialDraft?.features ?? DEFAULT_FEATURES,
  );
  const [fields, setFields] = useState<GeneratorFieldConfig[]>(initialDraft?.fields ?? []);
  const [layout, setLayout] = useState<ModuleLayout | null>(initialDraft?.layout ?? null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(initialDraft?.deleteMode ?? 'soft');
  const [menuIcon, setMenuIcon] = useState<MenuIcon | null>(initialDraft?.menuIcon ?? null);
  const [i18nDict, setI18nDict] = useState<ModuleI18nDict | undefined>(initialDraft?.i18n);
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [sampleRows, setSampleRows] = useState<DynamicListItem[]>(
    initialDraft?.sampleRows ?? [],
  );
  const [stepError, setStepError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [view, setView] = useState<'builder' | 'modules'>('builder');
  const [infoSession, setInfoSession] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingApiPlural, setEditingApiPlural] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ModuleDefinition | null>(null);

  // '' = semua status (draft + published) untuk opsi parent + target relasi.
  const definitionsQuery = useDynamicDefinitions('');
  const parentOptions = useMemo(
    () => parentOptionsFromDefinitions(definitionsQuery.data ?? []),
    [definitionsQuery.data],
  );

  useEffect(() => {
    if (publishResult) return;
    saveDraft({ info, features, fields, layout, deleteMode, menuIcon, i18n: i18nDict, sampleRows, step });
  }, [info, features, fields, layout, deleteMode, menuIcon, i18nDict, sampleRows, step, publishResult]);

  const effectiveLayout = useMemo(
    () => normalizeLayout(layout ?? defaultLayoutForFields(fields), fields.map((f) => f.name)),
    [layout, fields],
  );

  function buildConfig(): GeneratorConfig {
    const parent = resolveEffectiveParent(info);
    return {
      parentName: parent === '' ? null : parent,
      moduleName: info.moduleName.trim(),
      type: info.type,
      permissionKey: info.permissionKey.trim().toLowerCase(),
      features,
      fields,
      menuIcon: menuIcon ?? undefined,
      i18n: i18nDict,
    };
  }

  const draftDef = useMemo(
    () =>
      configToDefinition(buildConfig(), {
        status: 'draft',
        layout: effectiveLayout,
        deleteMode,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info, features, fields, effectiveLayout, deleteMode, menuIcon, i18nDict],
  );

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (!info.moduleName.trim()) return t('wizard.validateModuleRequired');
      if (!normalizeModuleName(info.moduleName)) return t('wizard.validateModuleInvalid');
      if (info.parentName === NEW_PARENT_VALUE) {
        if (!info.newParentName.trim()) return t('wizard.validateParentRequired');
        if (info.newParentName.length > 50) return t('wizard.validateParentMax');
        if (!/^[a-zA-Z0-9 /_-]*$/.test(info.newParentName)) {
          return t('wizard.validateParentInvalid');
        }
      } else if (info.parentName !== '' && !parentOptions.includes(info.parentName)) {
        return t('wizard.validateParentUnknown');
      }
      if (!info.permissionKey.trim()) return t('wizard.validatePermissionRequired');
      if (!/^[a-z][a-z0-9_]*$/.test(info.permissionKey.trim().toLowerCase())) {
        return t('wizard.validatePermissionInvalid');
      }
      if (!Object.values(features).some(Boolean)) return t('wizard.validateFeatureRequired');
      if ((features.bulkUpload || features.export) && !features.list) {
        return t('wizard.validateBulkList');
      }
      return null;
    }
    if (current === 1) {
      if (fields.length === 0) return t('wizard.validateFieldRequired');
      return null;
    }
    return null;
  }

  function handleNext(): void {
    const message = validateStep(step);
    if (message) {
      setStepError(message);
      return;
    }
    setStepError(null);
    if (step === 0) {
      // Masuk kanvas: selaraskan layout dengan fields terkini.
      setLayout((prev) =>
        normalizeLayout(prev ?? defaultLayoutForFields(fields), fields.map((f) => f.name)),
      );
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function handleBack(): void {
    setStepError(null);
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function resetWizard(): void {
    clearDraft();
    setStep(0);
    setInfo(INITIAL_INFO);
    setFeatures(DEFAULT_FEATURES);
    setFields([]);
    setLayout(null);
    setDeleteMode('soft');
    setMenuIcon(null);
    setI18nDict(undefined);
    setSampleRows([]);
    setStepError(null);
    setPublishResult(null);
    setEditingKey(null);
    setEditingApiPlural(null);
    setInfoSession((prev) => prev + 1);
  }

  /** Muat definisi listing ke wizard untuk diedit; publish menimpa key yang sama. */
  function loadDefinitionToWizard(def: ModuleDefinition): void {
    setInfo({
      parentName: def.parent ?? '',
      newParentName: '',
      moduleName: def.singularLabel,
      type: def.moduleType,
      permissionKey: def.permissionKey,
    });
    setFeatures({ ...def.features });
    setFields(structuredClone(def.fields));
    setLayout(structuredClone(def.layout));
    setDeleteMode(def.deleteMode);
    setMenuIcon(def.menuIcon ? { ...def.menuIcon } : null);
    setI18nDict(def.i18n ? structuredClone(def.i18n) : undefined);
    setSampleRows([]);
    setStep(0);
    setStepError(null);
    setPublishResult(null);
    setEditingKey(def.key);
    setEditingApiPlural(def.apiPlural);
    setInfoSession((prev) => prev + 1);
    setView('builder');
    showToast({ variant: 'info', message: t('wizard.loadToWizard', { key: def.key }) });
  }

  /** Modul dihapus dari daftar: reset wizard bila sedang mengeditnya. */
  function handleModuleDeleted(def: ModuleDefinition): void {
    setEditTarget((prev) => (prev !== null && prev.key === def.key ? null : prev));
    if (editingKey === def.key) resetWizard();
  }

  function requestEdit(def: ModuleDefinition): void {
    const draft = loadDraft();
    const hasWork =
      draft !== null && (draft.fields.length > 0 || draft.info.moduleName.trim() !== '');
    if (hasWork) {
      setEditTarget(def);
    } else {
      loadDefinitionToWizard(def);
    }
  }

  function handleAddSampleRow(values: DynamicFormValues): void {
    const nextId = Math.max(...sampleRows.map((row) => row.id), 0) + 1;
    setSampleRows((prev) => [...prev, valuesToSampleRow(values, nextId, fields)]);
    showToast({ variant: 'success', message: t('wizard.sampleRowAdded', { id: nextId }) });
    // Langsung lanjut ke List Canvas setelah test data dibuat.
    setStepError(null);
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  async function handlePublish(targetStatus: 'draft' | 'published'): Promise<void> {
    const config = buildConfig();
    const definition = configToDefinition(config, {
      status: targetStatus,
      layout: effectiveLayout,
      deleteMode,
    });
    const issues = validateDefinition(definition);
    if (issues.length > 0) {
      const shown = issues
        .slice(0, 3)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ');
      setStepError(
        issues.length > 3
          ? t('wizard.publishIssuesMore', { count: issues.length, shown })
          : t('wizard.publishIssues', { count: issues.length, shown }),
      );
      return;
    }
    setIsPublishing(true);
    setStepError(null);
    try {
      const saved = await saveDefinition(definition);
      await queryClient.invalidateQueries({ queryKey: ['dynamic-definitions'] });
      await queryClient.invalidateQueries({ queryKey: ['dynamic-definition', saved.definition.key] });
      // Modul published menambah baris di checklist permission role.
      if (targetStatus === 'published') {
        await queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      }
      // Edit yang mengubah key (ganti parent/nama): bersihkan definisi + records lama.
      if (editingKey && editingKey !== saved.definition.key) {
        await deleteDefinition(editingKey);
        if (editingApiPlural) await deleteModuleRecords(editingApiPlural);
        showToast({ variant: 'info', message: t('wizard.deleteOldModule', { key: editingKey }) });
      }
      setEditingKey(null);
      setEditingApiPlural(null);
      clearDraft();
      setPublishResult({ definition: saved.definition, created: saved.created });
      showToast({
        variant: 'success',
        message:
          targetStatus === 'published'
            ? t('wizard.publishedLive', { key: saved.definition.key })
            : t('wizard.draftSaved', { key: saved.definition.key }),
      });
      // Publish langsung tulis source statis ke repo (dev-server).
      // Di production build ini skipped by-design — tanpa toast.
      if (targetStatus === 'published') {
        const repo = await publishModuleToRepo(saved.definition);
        if (repo.state === 'written') {
          showToast({
            variant: 'success',
            message: t('wizard.writtenToRepo', {
              key: saved.definition.key,
              count: repo.count,
            }),
          });
        } else if (repo.reason !== 'build') {
          showToast({
            variant: 'warning',
            message: t('wizard.repoWriteSkipped', { message: repo.message }),
          });
        }
      }
    } catch (err) {
      setStepError(err instanceof Error ? err.message : t('wizard.saveFailed'));
    } finally {
      setIsPublishing(false);
    }
  }

  function handleDownloadContract(definition: ModuleDefinition): void {
    const json = JSON.stringify(buildApiContract(definition), null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), `${definition.apiPlural}.contract.json`);
  }

  if (publishResult) {
    const { definition, created } = publishResult;
    const isLive = definition.status === 'published';
    return (
      <div className="flex flex-col stack-gap">
        <Alert
          variant="success"
          message={
            isLive
              ? t('wizard.resultLive', { key: definition.key, verb: created ? t('wizard.created') : t('wizard.updated') })
              : t('wizard.resultDraft', { key: definition.key, verb: created ? t('wizard.created') : t('wizard.updated') })
          }
        />
        <Card title={`Modul: ${definition.singularLabel}`}>
          <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Key</dt>
            <dd className="font-mono text-xs text-foreground">{definition.key}</dd>
            <dt className="text-muted-foreground">Route</dt>
            <dd className="font-mono text-xs text-foreground">/{definition.routeBase}</dd>
            <dt className="text-muted-foreground">Data</dt>
            <dd className="font-mono text-xs text-foreground">{definition.apiPlural} (mock store)</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-foreground">{isLive ? 'Published' : 'Draft'}</dd>
            <dt className="text-muted-foreground">Fields</dt>
            <dd className="text-foreground">{definition.fields.length} field(s)</dd>
          </dl>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPublishResult(null)}>
              {t('wizard.editAgain')}
            </Button>
            <Button type="button" variant="secondary" onClick={resetWizard}>
              {t('wizard.newModule')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetWizard();
                setView('modules');
              }}
            >
              {t('wizard.viewList')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleDownloadContract(definition)}>
              {t('wizard.downloadContract')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col stack-gap">
      <div role="tablist" aria-label="Tampilan generator" className="flex items-center gap-4 border-b border-border">
        {(
          [
            { id: 'builder', label: t('wizard.builder') },
            { id: 'modules', label: t('wizard.moduleList') },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => setView(tab.id)}
            className={`-mb-px cursor-pointer border-b-2 px-1 pb-2 pt-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              view === tab.id
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent font-normal text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {view === 'modules' && (
        <Card title={t('wizard.modulesTitle')}>
          <ModulesTab
            definitions={definitionsQuery.data ?? []}
            isLoading={definitionsQuery.isLoading}
            onEdit={requestEdit}
            onDeleted={handleModuleDeleted}
          />
        </Card>
      )}
      {view === 'builder' && (
        <>
          <StepIndicator step={step} />
          {editingKey && (
            <Alert variant="info" message={t('wizard.editingModule', { key: editingKey })} />
          )}
          {stepError && <Alert variant="error" message={stepError} />}
          {initialDraft && step === 0 && (
            <Alert
              variant="info"
              message="Draft terakhir dimuat otomatis. Selesaikan atau mulai baru."
            />
          )}
          <Card
            title={step === 6 ? t('wizard.steps.review') : `${t('wizard.builder')} — ${t(`wizard.steps.${STEPS[step]}`)}`}
            actions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleBack}
                  disabled={step === 0}
                  icon={<ChevronLeft className="h-4 w-4" />}
                >
                  {t('common.back')}
                </Button>
                {step === 0 && (
                  <Button type="button" variant="secondary" onClick={resetWizard}>
                    {t('wizard.discardDraft')}
                  </Button>
                )}
                {step < 6 && (
                  <Button
                    type="button"
                    onClick={handleNext}
                    iconPosition="right"
                    icon={<ChevronRight className="h-4 w-4" />}
                  >
                    {t('common.next')}
                  </Button>
                )}
                {step === 6 && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPublishing}
                      onClick={() => void handlePublish('draft')}
                    >
                      {isPublishing ? t('wizard.saving') : t('wizard.saveAsDraft')}
                    </Button>
                    <Button
                      type="button"
                      disabled={isPublishing}
                      onClick={() => void handlePublish('published')}
                    >
                      {isPublishing ? t('wizard.publishing') : t('wizard.publish')}
                    </Button>
                  </>
                )}
              </div>
            }
          >
        {step === 0 && (
          <div className="flex flex-col stack-gap">
            <Card title="Module Info">
              <ModuleInfoStep
                key={infoSession}
                value={info}
                onChange={(next) => {
                  setInfo(next);
                  setStepError(null);
                }}
                errors={{}}
                parentOptions={parentOptions}
                menuIcon={menuIcon}
                onOpenIconDialog={() => setIconDialogOpen(true)}
              />
            </Card>
            <Card title="Features">
              <FeaturesStep value={features} onChange={setFeatures} />
            </Card>
          </div>
        )}
        {iconDialogOpen && (
          <IconPickerDialog
            open={iconDialogOpen}
            initial={menuIcon?.name ?? null}
            onClose={() => setIconDialogOpen(false)}
            onSave={(name) => {
              setMenuIcon(name === null ? null : { name });
              setStepError(null);
              showToast({
                variant: 'success',
                message:
                  name === null
                    ? t('wizard.iconRemoved')
                    : t('wizard.iconSaved'),
              });
            }}
          />
        )}
        {step === 1 && (
          <FormBuilderCanvas
            key={infoSession}
            fields={fields}
            onFieldsChange={setFields}
            layout={layout}
            onChange={setLayout}
            previewTitle={info.moduleName.trim() || 'Preview'}
            definitions={definitionsQuery.data ?? []}
            sampleRows={sampleRows}
            onSampleRowsChange={setSampleRows}
          />
        )}
        {step === 2 && (
          <TestDataPanel
            def={draftDef}
            onAddRow={handleAddSampleRow}
          />
        )}
        {step === 3 && (
          <ListBuilderCanvas
            def={draftDef}
            fields={fields}
            onFieldsChange={setFields}
            layout={effectiveLayout}
            onChange={setLayout}
            features={features}
            onFeaturesChange={setFeatures}
            deleteMode={deleteMode}
            onDeleteModeChange={setDeleteMode}
            sampleRows={sampleRows}
          />
        )}
        {step === 4 && (
          <DetailBuilderCanvas
            def={draftDef}
            fields={fields}
            layout={effectiveLayout}
            onChange={setLayout}
            sampleRows={sampleRows}
          />
        )}
        {step === 5 && (
          <TranslationStep config={buildConfig()} i18n={i18nDict} onI18nChange={setI18nDict} />
        )}
        {step === 6 && (
          <div className="flex flex-col stack-gap">
            <ReviewStep config={buildConfig()} layout={layout} deleteMode={deleteMode} />
            <ContractPanel def={draftDef} />
          </div>
        )}
          </Card>
        </>
      )}
      <Dialog
        testId="generator-edit-dialog"
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={t('wizard.loadToBuilder')}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                if (editTarget) loadDefinitionToWizard(editTarget);
                setEditTarget(null);
              }}
            >
              {t('wizard.discardAndLoad')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {t('wizard.loadConfirm', { key: editTarget?.key ?? '' })}
        </p>
      </Dialog>
    </div>
  );
}

export default GeneratorPage;
