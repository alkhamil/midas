import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge } from '../../../shared/components/ui';
import ModuleMenuIcon from './ModuleMenuIcon';
import type { FeatureKey, GeneratorConfig } from '../types';
import type { DeleteMode, ModuleLayout } from '../definitions';
import { configToDefinition, validateDefinition } from '../definitions';

interface ReviewStepProps {
  config: GeneratorConfig;
  layout: ModuleLayout | null;
  deleteMode: DeleteMode;
}

function ReviewStep({ config, layout, deleteMode }: ReviewStepProps) {
  const { t } = useTranslation();
  const preview = useMemo(
    () =>
      configToDefinition(config, {
        status: 'draft',
        layout: layout ?? undefined,
        deleteMode,
      }),
    [config, layout, deleteMode],
  );
  const issues = useMemo(() => validateDefinition(preview), [preview]);
  const features = (Object.keys(preview.features) as FeatureKey[]).filter(
    (key) => preview.features[key],
  );
  const formOrder = new Map(preview.layout.form.map((item) => [item.field, item]));
  const tableOrder = new Map(
    preview.layout.table.order.map((name, index) => [name, index] as const),
  );
  const tableHidden = new Set(preview.layout.table.hidden);
  const detailOrder = new Map(
    (preview.layout.detail?.order ?? []).map((name, index) => [name, index] as const),
  );
  const detailHidden = new Set(preview.layout.detail?.hidden ?? []);
  const sectionCount = preview.layout.form.filter((item) => item.kind === 'section').length;
  const dividerCount = preview.layout.form.filter((item) => item.kind === 'divider').length;
  const widthCount = Object.keys(preview.layout.table.widths ?? {}).length;

  return (
    <div className="flex flex-col stack-gap">
      {issues.length > 0 && (
        <Alert
          variant="error"
          message={
            <ul className="list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue.path}>
                  <span className="font-mono">{issue.path}</span>: {issue.message}
                </li>
              ))}
            </ul>
          }
        />
      )}

      <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t('review.module')}</dt>
        <dd className="font-medium text-foreground">
          {preview.singularLabel} ({preview.label})
        </dd>
        <dt className="text-muted-foreground">{t('review.parent')}</dt>
        <dd className="text-foreground">{preview.parent ?? '(root)'}</dd>
        <dt className="text-muted-foreground">{t('review.key')}</dt>
        <dd className="font-mono text-xs text-foreground">{preview.key}</dd>
        <dt className="text-muted-foreground">{t('review.route')}</dt>
        <dd className="font-mono text-xs text-foreground">/{preview.routeBase}</dd>
        <dt className="text-muted-foreground">{t('review.data')}</dt>
        <dd className="font-mono text-xs text-foreground">{preview.apiPlural} (mock store)</dd>
        <dt className="text-muted-foreground">{t('review.permission')}</dt>
        <dd className="font-mono text-xs text-foreground">
          {['view', 'create', 'update', 'delete', 'bulk_upload', 'export']
            .map((suffix) => `${preview.permissionKey}.${suffix}`)
            .join(', ')}
        </dd>
        <dt className="text-muted-foreground">{t('review.deleteMode')}</dt>
        <dd className="text-foreground">
          {preview.deleteMode === 'soft' ? 'Soft delete' : 'Hard delete'}
        </dd>
        <dt className="text-muted-foreground">{t('review.menuIcon')}</dt>
        <dd className="flex flex-wrap items-center gap-3 text-foreground">
          {!preview.menuIcon && <span className="text-muted-foreground">{t('review.defaultIcon')}</span>}
          {preview.menuIcon && (
            <span className="flex items-center gap-1.5 text-sm">
              <ModuleMenuIcon name={preview.menuIcon.name} className="h-5 w-5" />
              {preview.menuIcon.name} ({preview.parent ? t('review.parentScope') : t('review.moduleScope')})
            </span>
          )}
        </dd>
        <dt className="text-muted-foreground">{t('review.features')}</dt>
        <dd className="flex flex-wrap gap-1.5">
          {features.length === 0 && <span className="text-muted-foreground">-</span>}
          {features.map((key) => (
            <Badge key={key} variant="primary">
              {t(`registry.features.${key}`)}
            </Badge>
          ))}
        </dd>
        <dt className="text-muted-foreground">Fields</dt>
        <dd className="text-foreground">{t('review.fieldsCount', { count: preview.fields.length })}</dd>
        <dt className="text-muted-foreground">{t('review.layoutForm')}</dt>
        <dd className="text-foreground">
          {t('review.formSummary', { total: preview.layout.form.length, sections: sectionCount, dividers: dividerCount })}
        </dd>
        <dt className="text-muted-foreground">{t('review.layoutTable')}</dt>
        <dd className="text-foreground">
          {t('review.tableSummary', { shown: preview.layout.table.order.length - preview.layout.table.hidden.length })}
          {preview.layout.table.hidden.length > 0 &&
            ` (${t('review.hiddenCount', { count: preview.layout.table.hidden.length })})`}
          {widthCount > 0 && `, ${t('review.customWidths', { count: widthCount })}`}
        </dd>
        <dt className="text-muted-foreground">{t('review.layoutDetail')}</dt>
        <dd className="text-foreground">
          {t('review.detailSummary', { shown: (preview.layout.detail?.order.length ?? 0) - detailHidden.size })}
          {detailHidden.size > 0 && ` (${t('review.hiddenCount', { count: detailHidden.size })})`}
        </dd>
      </dl>

      {preview.fields.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t('review.fieldConfig')}</p>
          <ul className="rounded-lg border border-border">
            {preview.fields.map((field) => {
              const formItem = formOrder.get(field.name);
              const tableIndex = tableOrder.get(field.name);
              const hidden = tableHidden.has(field.name);
              const detailIndex = detailOrder.get(field.name);
              const detailHide = detailHidden.has(field.name);
              return (
                <li
                  key={field.name}
                  className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="font-medium text-foreground">{field.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{field.name}</span>
                  <span className="flex-1" />
                  {formItem && (
                    <Badge variant="secondary">
                      Form #{formItem.order + 1} ×{formItem.colSpan}
                    </Badge>
                  )}
                  {tableIndex !== undefined && !hidden && (
                    <Badge variant="info">Tabel #{tableIndex + 1}</Badge>
                  )}
                  {hidden && <Badge variant="secondary">{t('review.tableHidden')}</Badge>}
                  {detailIndex !== undefined && !detailHide && (
                    <Badge variant="info">Detail #{detailIndex + 1}</Badge>
                  )}
                  {detailHide && <Badge variant="secondary">{t('review.detailHidden')}</Badge>}
                  {field.source === 'relation' && field.relation && (
                    <Badge variant="primary">→ {field.relation.definitionKey}</Badge>
                  )}
                  {field.source !== 'none' && field.source !== 'relation' && (
                    <Badge variant="secondary">{t(`registry.dataSources.${field.source}`)}</Badge>
                  )}
                  {field.sortable !== false && <Badge variant="primary">{t('review.sortBadge')}</Badge>}
                  {field.filterable !== false && field.filterCriteria ? (
                    <Badge variant="info">
                      Filter: {t(`registry.filterCriteria.${field.filterCriteria}`)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t('review.noFilter')}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

    </div>
  );
}

export default ReviewStep;
