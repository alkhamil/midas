/** Canvas 2 — List Builder: tabel sungguhan + toolbar/filter + drawer properti. */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CanvasPointerSensor from './sensors';
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  FilterToolbar,
  RowActionButton,
  SelectField,
  SwitchField,
  TextField,
  useToast,
} from '../../../shared/components/ui';
import Table, { type Column } from '../../../shared/components/ui/Table';
import { listEmptyState } from '../../../shared/constants';
import { Download, Settings, Plus, Upload } from 'lucide-react';
import type { DeleteMode, ModuleDefinition, ModuleLayout } from '../definitions';
import { SYSTEM_TABLE_COLUMNS } from '../definitions';
import type {
  FeatureKey,
  FilterCriteria,
  GeneratorFieldConfig,
  RowActionColor,
  RowActionKind,
  TableDisplayProps,
} from '../types';
import {
  criteriaForFieldType,
  defaultCriteria,
} from '../registry';
import { columnRenderForType, staticOptionsOf, systemTableColumn } from '../runtime/cellRender';
import {
  moveTableColumn,
  setTableProps,
  setTableWidth,
  toggleTableColumn,
} from '../runtime/layoutOps';
import { buildFilterFields, filterDynamicRecords, paginateRecords } from '../runtime/filtering';
import { makeOptionsLoader, makeRelationOptionsLoader } from '../runtime/recordsApi';
import type { DynamicListItem } from '../runtime/types';

interface ListBuilderCanvasProps {
  def: ModuleDefinition;
  fields: GeneratorFieldConfig[];
  onFieldsChange: (fields: GeneratorFieldConfig[]) => void;
  layout: ModuleLayout;
  onChange: (layout: ModuleLayout) => void;
  features: Record<FeatureKey, boolean>;
  onFeaturesChange: (features: Record<FeatureKey, boolean>) => void;
  deleteMode: DeleteMode;
  onDeleteModeChange: (mode: DeleteMode) => void;
  sampleRows: DynamicListItem[];
}

const PAGE_SIZE = 10;

function WidthInput({ value, onCommit }: { value: number | undefined; onCommit: (px: number) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  return (
    <div className="w-24" title={t('list.widthTitle')}>
      <TextField
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => onCommit(draft === '' ? 0 : Number(draft))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(draft === '' ? 0 : Number(draft));
        }}
        placeholder={t('list.widthAuto')}
      />
    </div>
  );
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
 * Gagang resize antar kolom ala spreadsheet: hover garis tepi kanan header
 * (kursor ew-resize) lalu seret — lebar px dikomit live saat digeser.
 */
function ColumnResizer({ name, onWidth }: { name: string; onWidth: (px: number) => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={`list-col-resize-${name}`}
      title={t('list.resizeHint')}
      onPointerDown={(e) => {
        e.preventDefault();
        const th = e.currentTarget.closest('th');
        const startX = e.clientX;
        const startW = th ? th.getBoundingClientRect().width : 150;
        const handleMove = (ev: PointerEvent): void => {
          onWidth(Math.round(startW + ev.clientX - startX));
        };
        const handleUp = (): void => {
          window.removeEventListener('pointermove', handleMove);
          window.removeEventListener('pointerup', handleUp);
        };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
      }}
      className="group absolute bottom-0 right-0 top-0 z-10 w-3 translate-x-1/2 cursor-ew-resize touch-none"
    >
      <div className="mx-auto h-full w-0.5 bg-primary/60 opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}

/**
 * Header kolom kanvas: seret dari seluruh area sel + klik memilih (kolom
 * field + kolom sistem) + resize via garis tepi. Dipakai sebagai `header`
 * kolom tabel (sort dimatikan agar klik selalu memilih).
 *
 * `th` dibuat relative via className kolom; overlay + resizer absolut
 * berjangkar ke sel sehingga menutupi seluruh sel header.
 */
function SortableColumnHeader({
  name,
  label,
  hidden,
  selected,
  onSelect,
  onWidth,
}: {
  name: string;
  label: string;
  hidden: boolean;
  selected: boolean;
  onSelect: () => void;
  onWidth: (px: number) => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
  });
  // Posisi tekan untuk bedakan klik (pilih) vs seret (pindah): dnd-kit
  // mulai drag setelah jarak aktivasi, klik yang mengakhiri drag diabaikan.
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const { t } = useTranslation();
  // Overlay sendiri menjadi node sortable: `th` (relative via className
  // kolom) adalah containing block-nya sehingga menutupi seluruh sel.
  // (Transform di ancestor justru akan mengecilkan cakupan overlay.)
  return (
    <>
      <div className={`flex items-center gap-1 px-1 py-0.5 ${hidden ? 'opacity-50' : ''} ${isDragging ? 'opacity-60' : ''}`}>
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        {hidden && <Badge variant="secondary">{t('list.hiddenBadge')}</Badge>}
      </div>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        role="button"
        tabIndex={0}
        data-testid={`list-col-${name}`}
        {...listeners}
        onPointerDown={(e) => {
          downAt.current = { x: e.clientX, y: e.clientY };
          // Teruskan ke sensor dnd-kit agar drag tetap bisa mulai.
          listeners?.onPointerDown?.(e);
        }}
        onClick={(e) => {
          // Abaikan klik yang mengakhiri drag (drop sudah memindahkan).
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
        title={t('list.dragHint')}
        className={`absolute inset-0 cursor-grab active:cursor-grabbing ${
          selected
            ? 'bg-primary/5 ring-1 ring-inset ring-primary'
            : 'hover:bg-primary/5'
        }`}
      />
      <ColumnResizer name={name} onWidth={onWidth} />
    </>
  );
}

/** Isi drawer properti satu kolom: tampil/sort/filter/kriteria/lebar. */
function ColumnDrawerContent({
  field,
  hidden,
  width,
  onToggleHidden,
  onWidth,
  onSortable,
  onFilterable,
  onCriteria,
}: {
  field: GeneratorFieldConfig;
  hidden: boolean;
  width: number | undefined;
  onToggleHidden: () => void;
  onWidth: (px: number) => void;
  onSortable: (value: boolean) => void;
  onFilterable: (value: boolean) => void;
  onCriteria: (value: FilterCriteria) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col stack-gap">
      <Card size="sm" title={t('list.columnCard')}>
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
      <Card size="sm" title={t('list.interactCard')} collapsible>
        <div className="flex flex-col field-gap">
          <SwitchRow
            label={t('list.showColumn')}
            desc={t('list.showColumnDesc')}
            value={!hidden}
            onChange={() => onToggleHidden()}
          />
          <SwitchRow
            label={t('field.sortable')}
            desc={t('field.sortableDesc')}
            value={field.sortable !== false}
            onChange={onSortable}
          />
          <SwitchRow
            label={t('field.filterable')}
            desc={t('field.filterableDesc')}
            value={field.filterable !== false}
            onChange={onFilterable}
          />
          {field.filterable !== false && (
            <div className="rounded-lg border border-border px-3 py-2">
              <label className="mb-1 block text-xs font-medium text-foreground">
                {t('field.filterCriteria')}
              </label>
              <SelectField size="sm"
                value={field.filterCriteria ?? defaultCriteria(field.type)}
                onChange={(next) => onCriteria(next as FilterCriteria)}
                options={criteriaForFieldType(field.type).map((name) => ({
                  label: t(`registry.filterCriteria.${name}`),
                  value: name,
                }))}
                clearable={false}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {
                  t(`registry.filterCriteria.${field.filterCriteria ?? defaultCriteria(field.type)}Desc`)
                }
              </p>
            </div>
          )}
        </div>
      </Card>
      <Card size="sm" title={t('list.widthCard')} collapsible>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{t('list.widthLabel')}</p>
            <p className="text-xs text-muted-foreground">{t('list.widthDesc')}</p>
          </div>
          <WidthInput key={`${field.name}-${width ?? 'auto'}`} value={width} onCommit={onWidth} />
        </div>
      </Card>
    </div>
  );
}

/** Isi drawer aksi baris: lihat/edit/hapus + mode hapus + posisi kolom. */
/** Isi drawer properti kolom sistem: info + lebar (selalu tampil, sort/filter bawaan sistem). */
function SystemColumnDrawerContent({
  name,
  label,
  width,
  onWidth,
}: {
  name: string;
  label: string;
  width: number | undefined;
  onWidth: (px: number) => void;
}) {
  const { t } = useTranslation();
  const systemSortable = systemTableColumn(name)?.sortable ?? false;
  const noop = (): void => {};
  return (
    <div className="flex flex-col stack-gap">
      <Card size="sm" title={t('list.columnCard')}>
        <div className="flex flex-col field-gap">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('field.label')}</span>
            <span className="text-xs font-medium text-foreground">{label}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('field.name')}</span>
            <span className="font-mono text-xs text-muted-foreground">{name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('list.systemColumnNote')}</p>
        </div>
      </Card>
      <Card size="sm" title={t('list.interactCard')} collapsible>
        <div className="flex flex-col field-gap">
          <SwitchRow
            label={t('list.showColumn')}
            desc={t('list.showColumnSystemDesc')}
            value
            onChange={noop}
            disabled
          />
          <SwitchRow
            label={t('field.sortable')}
            desc={t('field.sortableDesc')}
            value={systemSortable}
            onChange={noop}
            disabled
          />
          <SwitchRow
            label={t('field.filterable')}
            desc={t('field.filterableDesc')}
            value={false}
            onChange={noop}
            disabled
          />
        </div>
      </Card>
      <Card size="sm" title={t('list.widthCard')} collapsible>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{t('list.widthLabel')}</p>
            <p className="text-xs text-muted-foreground">{t('list.widthDesc')}</p>
          </div>
          <WidthInput key={`${name}-${width ?? 'auto'}`} value={width} onCommit={onWidth} />
        </div>
      </Card>
    </div>
  );
}

const ACTION_COLOR_OPTIONS: { value: RowActionColor; labelKey: string }[] = [
  { value: 'default', labelKey: 'list.colorDefault' },
  { value: 'info', labelKey: 'list.colorInfo' },
  { value: 'warning', labelKey: 'list.colorWarning' },
  { value: 'danger', labelKey: 'list.colorDanger' },
  { value: 'success', labelKey: 'list.colorSuccess' },
  { value: 'muted', labelKey: 'list.colorMuted' },
];

function onPatchKindColor(
  displayProps: TableDisplayProps | undefined,
  onPatchProps: (patch: Partial<TableDisplayProps>) => void,
  kind: RowActionKind,
  color: RowActionColor,
): void {
  onPatchProps({ actionIconColor: { ...displayProps?.actionIconColor, [kind]: color } });
}

function ActionColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RowActionColor;
  onChange: (color: RowActionColor) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <SelectField size="sm"
        value={value}
        onChange={(next) => onChange(next as RowActionColor)}
        options={ACTION_COLOR_OPTIONS.map((opt) => ({ label: t(opt.labelKey), value: opt.value }))}
        clearable={false}
      />
    </div>
  );
}

function ActionDrawerContent({
  features,
  onToggleFeature,
  deleteMode,
  onDeleteModeChange,
  displayProps,
  onPatchProps,
}: {
  features: Record<FeatureKey, boolean>;
  onToggleFeature: (key: FeatureKey) => void;
  deleteMode: DeleteMode;
  onDeleteModeChange: (mode: DeleteMode) => void;
  displayProps: TableDisplayProps | undefined;
  onPatchProps: (patch: Partial<TableDisplayProps>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col stack-gap">
      <p className="text-xs text-muted-foreground">{t('list.actionVisibilityHint')}</p>
      <Card size="sm" title={t('list.actionCard')}>
        <div className="flex flex-col field-gap">
          <SwitchRow
            label={t('list.rowActView')}
            desc={t('list.rowActViewDesc')}
            value={features.detail}
            onChange={() => onToggleFeature('detail')}
          />
          <SwitchRow
            label={t('list.rowActEdit')}
            desc={t('list.rowActEditDesc')}
            value={features.edit}
            onChange={() => onToggleFeature('edit')}
          />
          <SwitchRow
            label={t('list.rowActDelete')}
            desc={t('list.rowActDeleteDesc')}
            value={features.delete}
            onChange={() => onToggleFeature('delete')}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">{t('list.deleteMode')}</label>
            <SelectField size="sm"
              value={deleteMode}
              onChange={(value) => onDeleteModeChange(value as DeleteMode)}
              options={[
                { label: t('list.softMode'), value: 'soft' },
                { label: t('list.hardMode'), value: 'hard' },
              ]}
              clearable={false}
            />
          </div>
        </div>
      </Card>
      <Card size="sm" title={t('list.actionIconCard')}>
        <div className="flex flex-col field-gap">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">{t('list.actionIconSize')}</label>
            <SelectField size="sm"
              value={String(displayProps?.actionIconSize ?? 16)}
              onChange={(value) => onPatchProps({ actionIconSize: Number(value) })}
              options={['14', '16', '18', '20', '24'].map((px) => ({ label: `${px} px`, value: px }))}
              clearable={false}
            />
          </div>
          <ActionColorRow
            label={t('list.actionColorView')}
            value={displayProps?.actionIconColor?.view ?? 'default'}
            onChange={(color) => onPatchKindColor(displayProps, onPatchProps, 'view', color)}
          />
          <ActionColorRow
            label={t('list.actionColorEdit')}
            value={displayProps?.actionIconColor?.edit ?? 'default'}
            onChange={(color) => onPatchKindColor(displayProps, onPatchProps, 'edit', color)}
          />
          <ActionColorRow
            label={t('list.actionColorDelete')}
            value={displayProps?.actionIconColor?.delete ?? 'default'}
            onChange={(color) => onPatchKindColor(displayProps, onPatchProps, 'delete', color)}
          />
          <ActionColorRow
            label={t('list.actionColorRestore')}
            value={displayProps?.actionIconColor?.restore ?? 'default'}
            onChange={(color) => onPatchKindColor(displayProps, onPatchProps, 'restore', color)}
          />
        </div>
      </Card>
      <Card size="sm" title={t('list.actionColCard')}>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">{t('list.actionPosition')}</label>
          <SelectField size="sm"
            value={displayProps?.actionPosition ?? 'right'}
            onChange={(value) =>
              onPatchProps({ actionPosition: value as 'left' | 'right' })
            }
            options={[
              { label: t('list.left'), value: 'left' },
              { label: t('list.right'), value: 'right' },
            ]}
            clearable={false}
          />
        </div>
      </Card>
    </div>
  );
}

/** Isi drawer pengaturan tabel: tombol list + props komponen Table. */
function TableDrawerContent({
  features,
  onToggleFeature,
  displayProps,
  onPatchProps,
  singularLabel,
}: {
  features: Record<FeatureKey, boolean>;
  onToggleFeature: (key: FeatureKey) => void;
  displayProps: TableDisplayProps | undefined;
  onPatchProps: (patch: Partial<TableDisplayProps>) => void;
  /** Label singular modul untuk default wording (prefill tampilan saja). */
  singularLabel: string;
}) {
  const { t } = useTranslation();
  const props = displayProps ?? {};
  // Prefill = default efektif saat ini; props tetap unset (fallback + i18n
  // terjaga) sampai pengguna benar-benar mengetik.
  const fallbackEmpty = listEmptyState(singularLabel);
  return (
    <div className="flex flex-col stack-gap">
      <Card size="sm" title={t('list.buttonsCard')}>
        <div className="flex flex-col field-gap">
          <SwitchRow
            label={t('list.bulkBtn')}
            desc={t('list.bulkDesc')}
            value={features.bulkUpload}
            onChange={() => onToggleFeature('bulkUpload')}
          />
          <SwitchRow
            label={t('list.exportBtn')}
            desc={t('list.exportDesc')}
            value={features.export}
            onChange={() => onToggleFeature('export')}
          />
          <p className="text-xs text-muted-foreground">
            {t('list.configNote')}
          </p>
        </div>
      </Card>
      <Card size="sm" title={t('list.tablePropsCard')} collapsible>
        <div className="flex flex-col field-gap">
          <SwitchRow
            label={t('list.propDense')}
            desc={t('list.propDenseDesc')}
            value={props.dense === true}
            onChange={(dense) => onPatchProps({ dense })}
          />
          <SwitchRow
            label={t('list.propFixed')}
            desc={t('list.propFixedDesc')}
            value={props.fixedLayout ?? true}
            onChange={(fixedLayout) => onPatchProps({ fixedLayout })}
          />
          <SwitchRow
            label={t('list.propStickyHead')}
            desc={t('list.propStickyHeadDesc')}
            value={props.stickyHeader === true}
            onChange={(stickyHeader) => onPatchProps({ stickyHeader })}
          />
          <SwitchRow
            label={t('list.propFreezeAction')}
            desc={t('list.propFreezeActionDesc')}
            value={props.stickyAction === true}
            onChange={(stickyAction) => onPatchProps({ stickyAction })}
          />
          <SwitchRow
            label={t('list.propHidePaging')}
            desc={t('list.propHidePagingDesc')}
            value={props.hidePagination === true}
            onChange={(hidePagination) => onPatchProps({ hidePagination })}
          />
          <SwitchRow
            label={t('list.propHideTotal')}
            desc={t('list.propHideTotalDesc')}
            value={props.hideTotalRecords === true}
            onChange={(hideTotalRecords) => onPatchProps({ hideTotalRecords })}
          />
          <p className="text-xs text-muted-foreground">
            {t('list.pageSizeNote')}
          </p>
        </div>
      </Card>
      <Card size="sm" title={t('list.emptyCard')} collapsible>
        <div className="flex flex-col field-gap">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('list.emptyCustomTitle')}</label>
            <TextField size="sm"
              value={props.emptyStateTitle ?? fallbackEmpty.title}
              onChange={(e) => onPatchProps({ emptyStateTitle: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('list.emptyCustomDesc')}</label>
            <TextField size="sm"
              value={props.emptyStateDescription ?? fallbackEmpty.description}
              onChange={(e) => onPatchProps({ emptyStateDescription: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('list.filteredCustomTitle')}</label>
            <TextField size="sm"
              value={props.filteredEmptyStateTitle ?? t('table.filteredTitle')}
              onChange={(e) => onPatchProps({ filteredEmptyStateTitle: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('list.filteredCustomDesc')}</label>
            <TextField size="sm"
              value={props.filteredEmptyStateDescription ?? t('table.filteredDesc')}
              onChange={(e) => onPatchProps({ filteredEmptyStateDescription: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('list.emptyHint')}
          </p>
        </div>
      </Card>
    </div>
  );
}

function ListBuilderCanvas({
  def,
  fields,
  onFieldsChange,
  layout,
  onChange,
  features,
  onFeaturesChange,
  deleteMode,
  onDeleteModeChange,
  sampleRows,
}: ListBuilderCanvasProps) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [activeName, setActiveName] = useState<string | null>(null);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const sensors = useSensors(
    useSensor(CanvasPointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byName = useMemo(() => new Map(fields.map((field) => [field.name, field])), [fields]);
  const widths = layout.table.widths ?? {};
  const displayProps = layout.table.props;
  const actionRight = (displayProps?.actionPosition ?? 'right') === 'right';
  // Urutan campuran field + kolom sistem (definisi lama tanpa kunci sistem
  // mendapatkannya di akhir, cermin fallback runtime).
  const order = useMemo(() => {
    const merged = [...layout.table.order];
    for (const key of SYSTEM_TABLE_COLUMNS) {
      if (!merged.includes(key)) merged.push(key);
    }
    return merged.filter((name) => byName.has(name) || SYSTEM_TABLE_COLUMNS.includes(name));
  }, [layout.table.order, byName]);
  const selectedField = selectedName ? byName.get(selectedName) : undefined;
  const selectedSystem =
    selectedName && !selectedField && SYSTEM_TABLE_COLUMNS.includes(selectedName)
      ? selectedName
      : null;
  const selectedSystemLabel = (() => {
    if (selectedSystem === null) return null;
    const system = systemTableColumn(selectedSystem);
    return typeof system?.header === 'string' ? system.header : selectedSystem;
  })();
  const drawerOpen =
    selectedField !== undefined || selectedSystem !== null || actionOpen || tableOpen;
  const previewDef = useMemo(() => ({ ...def, layout }), [def, layout]);

  function closeDrawers(): void {
    setSelectedName(null);
    setActionOpen(false);
    setTableOpen(false);
  }

  function selectColumn(name: string): void {
    setActionOpen(false);
    setTableOpen(false);
    setSelectedName(name);
  }

  function patchField(name: string, patch: Partial<GeneratorFieldConfig>): void {
    onFieldsChange(fields.map((f) => (f.name === name ? { ...f, ...patch } : f)));
  }

  function patchTableProps(patch: Partial<TableDisplayProps>): void {
    onChange(setTableProps(layout, patch));
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveName(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    setActiveName(null);
    if (!over || active.id === over.id) return;
    // Pastikan kunci sistem ikut tersimpan saat ikut diseret.
    const full = SYSTEM_TABLE_COLUMNS.every((key) => layout.table.order.includes(key))
      ? layout
      : {
          ...layout,
          table: {
            ...layout.table,
            order: [
              ...layout.table.order,
              ...SYSTEM_TABLE_COLUMNS.filter((key) => !layout.table.order.includes(key)),
            ],
          },
        };
    onChange(moveTableColumn(full, String(active.id), String(over.id)));
  }

  function toggleFeature(key: FeatureKey): void {
    onFeaturesChange({ ...features, [key]: !features[key] });
  }

  function previewAction(label: string): void {
    showToast({ variant: 'info', message: t('builder.previewAction', { label }) });
  }

  const filterFields = useMemo(
    () =>
      buildFilterFields(
        fields,
        (field) =>
          field.source === 'mockPagingInfinityScroll'
            ? makeOptionsLoader(previewDef, field)
            : field.source === 'relation'
              ? makeRelationOptionsLoader(field)
              : undefined,
        previewDef,
      ),
    [fields, previewDef],
  );
  const filteredRows = useMemo(
    () =>
      filterDynamicRecords(fields, sampleRows, {
        search: searchQuery.trim() === '' ? undefined : searchQuery,
        ...filterValues,
      }),
    [fields, sampleRows, searchQuery, filterValues],
  );
  const isFilterActive =
    searchQuery.trim() !== '' || Object.values(filterValues).some(Boolean);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = paginateRecords(filteredRows, safePage, PAGE_SIZE).content;

  const withActions = features.detail || features.edit || features.delete;
  const canvasColumns: Column<DynamicListItem>[] = order.map((name) => {
    const field = byName.get(name);
    const system = !field ? systemTableColumn(name) : null;
    if (!field && !system) return null;
    const label = field?.label ?? (typeof system?.header === 'string' ? system.header : name);
    const hidden = field ? layout.table.hidden.includes(name) : false;
    const selected = selectedName === name;
    const active = activeName === name;
    const render = field
      ? columnRenderForType(
        field.type,
        name,
        staticOptionsOf(field),
        field.source === 'mockPagingInfinityScroll'
          ? makeOptionsLoader(previewDef, field)
          : field.source === 'relation'
            ? makeRelationOptionsLoader(field)
            : undefined,
      )
      : (system?.render as Column<DynamicListItem>['render']);
    const column: Column<DynamicListItem> = {
      key: name,
      header: (
        <SortableColumnHeader
          name={name}
          label={label}
          hidden={hidden}
          selected={selected}
          onSelect={() => selectColumn(name)}
          onWidth={(px) => onChange(setTableWidth(layout, name, px))}
        />
      ),
      // Ikon sort mengikuti setting field; klik header tetap memilih kolom
      // (tanpa onSort) agar tak bentrok seleksi/drag.
      sortable: field ? field.sortable !== false : (system?.sortable ?? false),
    };
    if (render) column.render = render;
    if (widths[name]) column.width = widths[name];
    // relative: jangkar overlay seret + resizer. Highlight kolom
    // terpilih menempel di th + td (className dipakai keduanya).
    const highlight = `relative ${hidden ? 'opacity-50' : ''} ${selected ? 'bg-primary/5' : ''} ${active ? 'opacity-40' : ''} ${system?.className ?? ''}`;
    column.className = highlight.trim().replace(/\s+/g, ' ');
    return column;
  }).filter((col): col is Column<DynamicListItem> => col !== null);
  const activeField = activeName ? byName.get(activeName) : undefined;
  const activeSystem = activeName && !activeField ? systemTableColumn(activeName) : null;
  const activeLabel =
    activeField?.label ?? (typeof activeSystem?.header === 'string' ? activeSystem.header : activeName);
  const activeColumn = activeName ? canvasColumns.find((col) => col.key === activeName) : undefined;
  // Class literal penuh (tanpa interpolasi) agar terdeteksi Tailwind.
  // Highlight kolom aksi menempel di SELURUH area th + td.
  const actionHighlight =
    actionOpen && withActions
      ? actionRight
        ? '[&_th:last-child]:bg-primary/5 [&_th:last-child]:ring-1 [&_th:last-child]:ring-inset [&_th:last-child]:ring-primary [&_td:last-child]:bg-primary/5'
        : '[&_th:nth-child(2)]:bg-primary/5 [&_th:nth-child(2)]:ring-1 [&_th:nth-child(2)]:ring-inset [&_th:nth-child(2)]:ring-primary [&_td:nth-child(2)]:bg-primary/5'
      : '';

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('detail.needFields')}</p>;
  }

  return (
    <div className="flex flex-col stack-gap">
      <div className="flex flex-col field-gap">
        <Alert
          variant="info"
          message="Geser dari area header mana pun untuk memindahkan • klik header untuk atur properti • arahkan ke garis antar kolom untuk ubah lebar."
        />
        <div>
          <Button
            variant="secondary"
            icon={<Settings className="h-4 w-4" />}
            onClick={() => {
              setSelectedName(null);
              setActionOpen(false);
              setTableOpen(true);
            }}
            testId="list-table-settings"
          >
            {t('list.tableSettingsBtn')}
          </Button>
        </div>
      </div>
      <Card
        testId="list-canvas-card"
        title={`${def.singularLabel} List`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {features.export && (
              <Button
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={() => previewAction(t('list.actExport'))}
              >
                {t('common.export')}
              </Button>
            )}
            {features.bulkUpload && (
              <Button
                variant="secondary"
                icon={<Upload className="h-4 w-4" />}
                onClick={() => previewAction(t('list.actBulk'))}
              >
                {t('common.bulkUpload')}
              </Button>
            )}
            {features.create && (
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => previewAction(t('list.actCreate'))}
              >
                {t('list.createTitle', { singular: def.singularLabel })}
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4">
          <FilterToolbar
            testId="list-canvas-filter"
            searchValue={searchQuery}
            onSearchChange={(value) => {
              setSearchQuery(value);
              setPage(1);
            }}
            filterFields={filterFields}
            filterValues={filterValues}
            onApply={(values) => {
              setFilterValues(values);
              setPage(1);
            }}
            onReset={() => {
              setFilterValues({});
              setPage(1);
            }}
            searchPlaceholder={t('filter.search')}
            searchParamName="search"
          />
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveName(null)}
        >
          <DragOverlay dropAnimation={null}>
            {(activeField || activeSystem) && activeName ? (
              <div className="min-w-36 rounded-lg border border-primary bg-surface px-3 py-2 opacity-90 shadow-lg">
                <p className="text-xs font-medium text-foreground">{activeLabel}</p>
                {pageRows.slice(0, 3).map((row: DynamicListItem, rowIndex?: number) => (
                  <div key={rowIndex} className="truncate text-xs text-muted-foreground">
                    {activeColumn?.render
                      ? activeColumn.render(row, rowIndex)
                      : String(row[activeName] ?? '')}
                  </div>
                ))}
              </div>
            ) : null}
          </DragOverlay>
          <SortableContext items={order} strategy={horizontalListSortingStrategy}>
            <div className={actionHighlight}>
            <Table
              testId="list-canvas-table"
              columns={canvasColumns}
              data={pageRows}
              totalRecords={filteredRows.length}
              page={safePage}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
              actionWidth={withActions ? 'w-40' : undefined}
              actionPosition={displayProps?.actionPosition ?? 'right'}
              showRowNumber
              actionHeader={
                withActions ? (
                  <div
                    role="button"
                    tabIndex={0}
                    data-testid="list-col-action"
                    onClick={() => {
                      setSelectedName(null);
                      setTableOpen(false);
                      setActionOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedName(null);
                        setTableOpen(false);
                        setActionOpen(true);
                      }
                    }}
                    title={t('list.actionHint')}
                    className="flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5"
                  >
                    <span className="text-sm font-medium">{t('table.action')}</span>
                  </div>
                ) : undefined
              }
              renderAction={
                withActions
                  ? (row) => (
                      <div className="flex justify-evenly w-full gap-1">
                        {features.detail && (
                          <RowActionButton
                            action="view"
                            testId={`list-canvas-view-${row.id}`}
                            title={t('list.rowView', { id: row.id })}
                            onClick={() => previewAction(t('list.actView'))}
                            iconSize={displayProps?.actionIconSize}
                            color={displayProps?.actionIconColor?.view}
                          />
                        )}
                        {features.edit && (
                          <RowActionButton
                            action="edit"
                            testId={`list-canvas-edit-${row.id}`}
                            title={t('list.rowEdit', { id: row.id })}
                            onClick={() => previewAction(t('list.actEdit'))}
                            iconSize={displayProps?.actionIconSize}
                            color={displayProps?.actionIconColor?.edit}
                          />
                        )}
                        {features.delete && row.status === 'active' && (
                          <RowActionButton
                            action="delete"
                            testId={`list-canvas-delete-${row.id}`}
                            title={t('list.rowDelete', { id: row.id })}
                            onClick={() => previewAction(t('list.actDelete'))}
                            iconSize={displayProps?.actionIconSize}
                            color={displayProps?.actionIconColor?.delete}
                          />
                        )}
                        {features.delete && deleteMode === 'soft' && row.status === 'inactive' && (
                          <RowActionButton
                            action="restore"
                            testId={`list-canvas-restore-${row.id}`}
                            title={t('list.rowRestore', { id: row.id })}
                            onClick={() => previewAction(t('list.actRestore'))}
                            iconSize={displayProps?.actionIconSize}
                            color={displayProps?.actionIconColor?.restore}
                          />
                        )}
                      </div>
                    )
                  : undefined
              }
              rowKey={(row: DynamicListItem) => String(row.id)}
              fixedLayout={displayProps?.fixedLayout ?? true}
              dense={displayProps?.dense}
              hidePagination={displayProps?.hidePagination}
              hideTotalRecords={displayProps?.hideTotalRecords}
              stickyHeader={displayProps?.stickyHeader}
              stickyAction={displayProps?.stickyAction}
              isEmptyState={sampleRows.length === 0 && !isFilterActive}
              isFilteredEmptyState={isFilterActive && filteredRows.length === 0}
              emptyStateTitle={displayProps?.emptyStateTitle?.trim() || t('list.emptyTitle')}
              emptyStateDescription={displayProps?.emptyStateDescription?.trim() || t('list.emptyDesc')}
              filteredEmptyStateTitle={displayProps?.filteredEmptyStateTitle?.trim() || undefined}
              filteredEmptyStateDescription={displayProps?.filteredEmptyStateDescription?.trim() || undefined}
            />
            </div>
          </SortableContext>
        </DndContext>
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawers}
        closeOnBackdropClick={false}
        title={
          selectedField
            ? t('list.columnTitle', { label: selectedField.label })
            : selectedSystemLabel !== null
              ? t('list.columnTitle', { label: selectedSystemLabel })
              : actionOpen
                ? t('list.actionTitle')
                : t('list.tableSettings')
        }
        width="md"
        modal={false}
        testId="list-property-drawer"
      >
        {selectedField ? (
          <ColumnDrawerContent
            key={selectedField.name}
            field={selectedField}
            hidden={layout.table.hidden.includes(selectedField.name)}
            width={widths[selectedField.name]}
            onToggleHidden={() => onChange(toggleTableColumn(layout, selectedField.name))}
            onWidth={(px) => onChange(setTableWidth(layout, selectedField.name, px))}
            onSortable={(value) => patchField(selectedField.name, { sortable: value })}
            onFilterable={(value) =>
              patchField(selectedField.name, {
                filterable: value,
                filterCriteria: value ? (selectedField.filterCriteria ?? undefined) : null,
              })
            }
            onCriteria={(value) => patchField(selectedField.name, { filterCriteria: value })}
          />
        ) : selectedSystem !== null && selectedSystemLabel !== null ? (
          <SystemColumnDrawerContent
            key={selectedSystem}
            name={selectedSystem}
            label={selectedSystemLabel}
            width={widths[selectedSystem]}
            onWidth={(px) => onChange(setTableWidth(layout, selectedSystem, px))}
          />
        ) : actionOpen ? (
          <ActionDrawerContent
            features={features}
            onToggleFeature={toggleFeature}
            deleteMode={deleteMode}
            onDeleteModeChange={onDeleteModeChange}
            displayProps={displayProps}
            onPatchProps={patchTableProps}
          />
        ) : (
          <TableDrawerContent
            features={features}
            onToggleFeature={toggleFeature}
            displayProps={displayProps}
            onPatchProps={patchTableProps}
            singularLabel={def.singularLabel}
          />
        )}
      </Drawer>
    </div>
  );
}

export default ListBuilderCanvas;
