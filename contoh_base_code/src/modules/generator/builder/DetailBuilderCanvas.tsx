/** Canvas 3 — Detail Builder: kartu detail langsung (drag-drop baris + drawer properti). */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CanvasPointerSensor from './sensors';
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  SwitchField,
  TextField,
} from '../../../shared/components/ui';
import { Settings } from 'lucide-react';
import { capitalize } from '../../../shared/utils';
import type { ModuleDefinition, ModuleLayout } from '../definitions';
import { SYSTEM_TABLE_COLUMNS } from '../definitions';
import type {
  DetailCardDisplayProps,
  DetailRowDisplayProps,
  GeneratorFieldConfig,
} from '../types';
import {
  detailValue,
} from '../runtime/hooks';
import {
  moveDetailItem,
  setDetailCardProps,
  setDetailRowProps,
  toggleDetailItem,
} from '../runtime/layoutOps';
import { sampleToDetail } from './draft';
import type { DynamicDetail, DynamicListItem } from '../runtime/types';

interface DetailBuilderCanvasProps {
  def: ModuleDefinition;
  fields: GeneratorFieldConfig[];
  layout: ModuleLayout;
  onChange: (layout: ModuleLayout) => void;
  sampleRows: DynamicListItem[];
}

function SwitchRow({
  label,
  desc,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <SwitchField value={value} onChange={onChange} size="sm" disabled={disabled} />
    </div>
  );
}

/**
 * Baris detail kanvas: seret dari area mana pun (tanpa gagang) + klik
 * memilih. Markup meniru DetailCard (grid label/nilai, divider).
 */
function SortableDetailRow({
  name,
  label,
  value,
  rowProps,
  showBorder,
  hidden,
  selected,
  onSelect,
}: {
  name: string;
  label: string;
  value: React.ReactNode;
  rowProps: DetailRowDisplayProps | undefined;
  showBorder: boolean;
  hidden: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
  });
  // Posisi tekan untuk bedakan klik (pilih) vs seret (pindah).
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const { t } = useTranslation();
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'opacity-60' : ''}
    >
      <div
        role="button"
        tabIndex={0}
        data-testid={`detail-row-${name}`}
        {...listeners}
        onPointerDown={(e) => {
          downAt.current = { x: e.clientX, y: e.clientY };
          listeners?.onPointerDown?.(e);
        }}
        onClick={(e) => {
          const down = downAt.current;
          downAt.current = null;
          if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
            return;
          }
          onSelect();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect();
        }}
        title={t('detail.dragHint')}
        className={`cursor-grab active:cursor-grabbing ${
          selected ? 'bg-primary/5 ring-1 ring-inset ring-primary' : 'hover:bg-primary/5'
        } ${hidden ? 'opacity-50' : ''}`}
      >
        {rowProps?.heading ? (
          <div
            className={`flex items-center justify-between gap-2 ${showBorder ? 'border-t border-border' : ''}`}
          >
            <span className="text-base font-semibold text-foreground">{label}</span>
          </div>
        ) : rowProps?.fullWidth ? (
          <div className={`py-4 ${showBorder ? 'border-t border-border' : ''}`}>{value}</div>
        ) : (
          <div
            className={`grid grid-cols-[300px_1fr] gap-4 py-4 px-0 ${showBorder ? 'border-t border-border' : ''}`}
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="text-sm break-all text-foreground">{value}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Isi drawer properti satu baris: tampil + props tampilan. */
function RowDrawerContent({
  field,
  hidden,
  rowProps,
  onToggleHidden,
  onPatchProps,
}: {
  field: GeneratorFieldConfig;
  hidden: boolean;
  rowProps: DetailRowDisplayProps | undefined;
  onToggleHidden: () => void;
  onPatchProps: (patch: Partial<DetailRowDisplayProps>) => void;
}) {
  const { t } = useTranslation();
  const props = rowProps ?? {};
  return (
    <div className="flex flex-col stack-gap">
      <Card size="sm" title={t('detail.rowCard')}>
        <div className="flex flex-col field-gap">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('field.label')}</span>
            <span className="text-xs font-medium text-foreground">{field.label}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('field.name')}</span>
            <span className="font-mono text-xs text-muted-foreground">{field.name}</span>
          </div>
        </div>
      </Card>
      <Card size="sm" title={t('detail.styleCard')} collapsible>
        <div className="flex flex-col field-gap">
          <SwitchRow
            label={t('detail.showRow')}
            desc={t('detail.showRowDesc')}
            value={!hidden}
            onChange={() => onToggleHidden()}
          />
          <SwitchRow
            label={t('detail.headingMode')}
            desc={t('detail.headingModeDesc')}
            value={props.heading === true}
            onChange={(heading) => onPatchProps({ heading })}
          />
          <SwitchRow
            label={t('detail.fullWidth')}
            desc={t('detail.fullWidthDesc')}
            value={props.fullWidth === true}
            onChange={(fullWidth) => onPatchProps({ fullWidth })}
          />
          <SwitchRow
            label={t('detail.noDivider')}
            desc={t('detail.noDividerDesc')}
            value={props.noDivider === true}
            onChange={(noDivider) => onPatchProps({ noDivider })}
          />
        </div>
      </Card>
    </div>
  );
}

/** Isi drawer properti baris sistem: info + gaya (selalu tampil). */
function SystemRowDrawerContent({
  name,
  label,
  rowProps,
  onPatchProps,
}: {
  name: string;
  label: string;
  rowProps: DetailRowDisplayProps | undefined;
  onPatchProps: (patch: Partial<DetailRowDisplayProps>) => void;
}) {
  const { t } = useTranslation();
  const props = rowProps ?? {};
  const noop = (): void => {};
  return (
    <div className="flex flex-col stack-gap">
      <Card size="sm" title={t('detail.rowCard')}>
        <div className="flex flex-col field-gap">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('field.label')}</span>
            <span className="text-xs font-medium text-foreground">{label}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('field.name')}</span>
            <span className="font-mono text-xs text-muted-foreground">{name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('detail.systemRowNote')}</p>
        </div>
      </Card>
      <Card size="sm" title={t('detail.styleCard')} collapsible>
        <div className="flex flex-col field-gap">
          <SwitchRow
            label={t('detail.showRow')}
            desc={t('detail.showRowSystemDesc')}
            value
            onChange={noop}
            disabled
          />
          <SwitchRow
            label={t('detail.headingMode')}
            desc={t('detail.headingModeDesc')}
            value={props.heading === true}
            onChange={(heading) => onPatchProps({ heading })}
          />
          <SwitchRow
            label={t('detail.fullWidth')}
            desc={t('detail.fullWidthDesc')}
            value={props.fullWidth === true}
            onChange={(fullWidth) => onPatchProps({ fullWidth })}
          />
          <SwitchRow
            label={t('detail.noDivider')}
            desc={t('detail.noDividerDesc')}
            value={props.noDivider === true}
            onChange={(noDivider) => onPatchProps({ noDivider })}
          />
        </div>
      </Card>
    </div>
  );
}

/** Isi drawer pengaturan kartu detail. */
function DetailCardDrawerContent({
  singularLabel,
  card,
  onPatchCard,
}: {
  singularLabel: string;
  card: DetailCardDisplayProps | undefined;
  onPatchCard: (patch: Partial<DetailCardDisplayProps>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col stack-gap">
      <Card size="sm" title={t('detail.cardCard')}>
        <div className="flex flex-col field-gap">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('detail.cardTitle')}</label>
            <TextField
              size="sm"
              value={card?.title ?? ''}
              onChange={(e) => onPatchCard({ title: e.target.value })}
              placeholder={t('detail.cardTitleDefault', { singular: singularLabel })}
              maxLength={100}
            />
          </div>
          <SwitchRow
            label={t('detail.collapsible')}
            desc={t('detail.collapsibleDesc')}
            value={card?.collapsible === true}
            onChange={(collapsible) => onPatchCard({ collapsible })}
          />
        </div>
      </Card>
    </div>
  );
}

function DetailBuilderCanvas({
  def,
  fields,
  layout,
  onChange,
  sampleRows,
}: DetailBuilderCanvasProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(CanvasPointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byName = useMemo(() => new Map(fields.map((field) => [field.name, field])), [fields]);
  const detail = layout.detail ?? { order: fields.map((f) => f.name), hidden: [] };
  const cardProps = layout.detail?.card;
  const selectedField = selectedName ? byName.get(selectedName) : undefined;
  const selectedSystem =
    selectedName && !selectedField && SYSTEM_TABLE_COLUMNS.includes(selectedName)
      ? selectedName
      : null;
  const drawerOpen = selectedField !== undefined || selectedSystem !== null || cardOpen;
  // Urutan tampil: kunci sistem mengikuti posisi di order; yang belum ada
  // memakai fallback lama (status di depan, created_* di belakang).
  const displayOrder = useMemo(() => {
    const merged = detail.order.filter(
      (name) => byName.has(name) || SYSTEM_TABLE_COLUMNS.includes(name),
    );
    if (!merged.includes('status')) merged.unshift('status');
    for (const key of ['created_by', 'created_date']) {
      if (!merged.includes(key)) merged.push(key);
    }
    return merged;
  }, [detail.order, byName]);
  const item: DynamicDetail | null = useMemo(
    () => (sampleRows.length > 0 ? sampleToDetail(sampleRows[0]) : null),
    [sampleRows],
  );

  function closeDrawers(): void {
    setSelectedName(null);
    setCardOpen(false);
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Pastikan kunci sistem ikut tersimpan saat ikut diseret.
    const base = layout.detail ?? { order: [], hidden: [] as string[] };
    const full = displayOrder.every((key) => base.order.includes(key))
      ? layout
      : { ...layout, detail: { ...base, order: displayOrder } };
    onChange(moveDetailItem(full, String(active.id), String(over.id)));
  }

  function systemRowValue(name: string): React.ReactNode {
    if (name === 'created_by') return item?.createdBy ?? '';
    if (name === 'created_date') return item?.createdDate ?? '';
    return item ? (
      <Badge variant={item.status === 'active' ? 'success' : 'secondary'}>
        {capitalize(item.status)}
      </Badge>
    ) : (
      ''
    );
  }

  function systemRowLabel(name: string): string {
    if (name === 'created_by') return 'Created By';
    if (name === 'created_date') return 'Created Date';
    return 'Status';
  }

  function rowValue(field: GeneratorFieldConfig): React.ReactNode {
    if (!item) return '';
    return detailValue(field, item) as React.ReactNode;
  }

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('detail.needFields')}</p>;
  }

  let prevWasHeading = false;

  return (
    <div className="flex flex-col stack-gap">
      <div className="flex flex-col field-gap">
        <Alert
          variant="info"
          message={t('detail.canvasHint')}
        />
        <div>
          <Button
            variant="secondary"
            icon={<Settings className="h-4 w-4" />}
            onClick={() => {
              setSelectedName(null);
              setCardOpen(true);
            }}
            testId="detail-card-settings"
          >
            {t('detail.cardSettings')}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={displayOrder}
          strategy={verticalListSortingStrategy}
        >
          <Card
            testId="detail-canvas-card"
            title={cardProps?.title?.trim() || t('detail.cardTitleDefault', { singular: def.singularLabel })}
            collapsible={cardProps?.collapsible === true}
          >
            {displayOrder.map((name, index) => {
              const field = byName.get(name);
              const isSystem = !field && SYSTEM_TABLE_COLUMNS.includes(name);
              if (!field && !isSystem) return null;
              const hidden = field ? detail.hidden.includes(name) : false;
              const rowProps = layout.detail?.props?.[name];
              const showBorder = index > 0 && !rowProps?.noDivider && !prevWasHeading;
              const isHeading = rowProps?.heading === true;
              prevWasHeading = isHeading;
              return (
                <SortableDetailRow
                  key={name}
                  name={name}
                  label={field ? field.label : systemRowLabel(name)}
                  value={field ? rowValue(field) : systemRowValue(name)}
                  rowProps={rowProps}
                  showBorder={showBorder}
                  hidden={hidden}
                  selected={selectedName === name}
                  onSelect={() => {
                    setCardOpen(false);
                    setSelectedName(name);
                  }}
                />
              );
            })}
          </Card>
        </SortableContext>
      </DndContext>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawers}
        closeOnBackdropClick={false}
        title={
          selectedField
            ? t('detail.rowTitle', { label: selectedField.label })
            : selectedSystem !== null
              ? t('detail.rowTitle', { label: systemRowLabel(selectedSystem) })
              : t('detail.cardSettings')
        }
        width="md"
        modal={false}
        testId="detail-property-drawer"
      >
        {selectedField ? (
          <RowDrawerContent
            key={selectedField.name}
            field={selectedField}
            hidden={detail.hidden.includes(selectedField.name)}
            rowProps={layout.detail?.props?.[selectedField.name]}
            onToggleHidden={() => onChange(toggleDetailItem(layout, selectedField.name))}
            onPatchProps={(patch) => onChange(setDetailRowProps(layout, selectedField.name, patch))}
          />
        ) : selectedSystem !== null ? (
          <SystemRowDrawerContent
            key={selectedSystem}
            name={selectedSystem}
            label={systemRowLabel(selectedSystem)}
            rowProps={layout.detail?.props?.[selectedSystem]}
            onPatchProps={(patch) => onChange(setDetailRowProps(layout, selectedSystem, patch))}
          />
        ) : (
          <DetailCardDrawerContent
            singularLabel={def.singularLabel}
            card={cardProps}
            onPatchCard={(patch) => onChange(setDetailCardProps(layout, patch))}
          />
        )}
      </Drawer>
    </div>
  );
}

export default DetailBuilderCanvas;
