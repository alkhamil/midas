/** Canvas 1 — Form Builder: palet komponen + kanvas grid drag-drop + drawer properti + preview. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import CanvasPointerSensor from './sensors';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Alert,
  Button,
  Card,
  Dialog,
  Drawer,
  FormGroup,
  TextField,
} from '../../../shared/components/ui';
import {
  AlignLeft,
  Banknote,
  Calendar,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  CircleDot,
  GripVertical,
  Hash,
  Heading,
  Link2,
  ListChecks,
  ListTodo,
  Lock,
  Minus,
  Palette as PaletteIcon,
  PenLine,
  Table,
  ToggleRight,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import type { GeneratorFieldConfig } from '../types';
import { deriveFieldNaming, isReservedFieldName, uniqueFieldName } from '../parser';
import type { FormLayoutItem, ModuleDefinition, ModuleLayout } from '../definitions';
import { defaultLayoutForFields, normalizeLayout } from '../definitions';
import { colSpanClass } from '../runtime/grid';
import {
  addFormItem,
  moveFormItem,
  removeFormItem,
  renameFieldInLayout,
  setFormItemLabel,
  setFormSpan,
} from '../runtime/layoutOps';
import { renderDynamicField } from '../runtime/fieldRenderer';
import { makeOptionsLoader, makeRelationOptionsLoader } from '../runtime/recordsApi';
import type { DynamicListItem } from '../runtime/types';
import FieldForm, {
  buildFieldConfig,
  initialFormValue,
  type FieldFormPreset,
  type FieldFormValue,
} from '../components/FieldForm';

interface FormBuilderCanvasProps {
  fields: GeneratorFieldConfig[];
  onFieldsChange: (fields: GeneratorFieldConfig[]) => void;
  layout: ModuleLayout | null;
  onChange: (layout: ModuleLayout) => void;
  previewTitle: string;
  definitions: ModuleDefinition[];
  sampleRows: DynamicListItem[];
  onSampleRowsChange: (rows: DynamicListItem[]) => void;
}

type PaletteKind =
  | 'text'
  | 'number'
  | 'currency'
  | 'textarea'
  | 'password'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'checkboxgroup'
  | 'date'
  | 'daterange'
  | 'switch'
  | 'upload'
  | 'color'
  | 'editor'
  | 'array'
  | 'relation'
  | 'section'
  | 'divider';

const PALETTE_SECTIONS: { titleKey: string; items: PaletteKind[] }[] = [
  {
    titleKey: 'builder.paletteSections.fields',
    items: [
      'text', 'number', 'currency', 'textarea', 'password', 'select', 'multiselect',
      'radio', 'checkbox', 'checkboxgroup', 'date', 'daterange', 'switch', 'upload',
      'color', 'editor', 'array', 'relation',
    ],
  },
  {
    titleKey: 'builder.paletteSections.layout',
    items: ['section', 'divider'],
  },
];

function presetForKind(kind: PaletteKind): FieldFormPreset {
  switch (kind) {
    case 'number':
      return { type: 'numberField', label: 'Number' };
    case 'currency':
      return { type: 'currencyField', label: 'Currency' };
    case 'textarea':
      return { type: 'textareaField', label: 'Textarea' };
    case 'password':
      return { type: 'passwordField', label: 'Password' };
    case 'select':
      return { type: 'selectField', source: 'mockStatic', label: 'Select' };
    case 'multiselect':
      return { type: 'selectMultipleField', source: 'mockStatic', label: 'Multi Select' };
    case 'radio':
      return { type: 'radioGroupField', source: 'mockStatic', label: 'Radio' };
    case 'checkbox':
      return { type: 'checkboxField', label: 'Checkbox' };
    case 'checkboxgroup':
      return { type: 'checkboxGroupField', source: 'mockStatic', label: 'Checkbox Group' };
    case 'date':
      return { type: 'dateField', label: 'Date' };
    case 'daterange':
      return { type: 'dateRangeField', label: 'Date Range' };
    case 'switch':
      return { type: 'switchField', label: 'Switch' };
    case 'upload':
      return { type: 'fileUploadField', label: 'Upload' };
    case 'color':
      return { type: 'colorField', label: 'Color' };
    case 'editor':
      return { type: 'editorField', label: 'Editor' };
    case 'array':
      return { type: 'formArrayField', label: 'Array' };
    case 'relation':
      return { type: 'selectField', source: 'relation', label: 'Relation' };
    default:
      return { type: 'textField', label: 'Text' };
  }
}

/** Ikon per jenis komponen palet (lucide-react). */
const PALETTE_ICONS: Record<PaletteKind, typeof Type> = {
  text: Type,
  number: Hash,
  currency: Banknote,
  textarea: AlignLeft,
  password: Lock,
  select: ChevronDown,
  multiselect: ListChecks,
  radio: CircleDot,
  checkbox: CheckSquare,
  checkboxgroup: ListTodo,
  date: Calendar,
  daterange: CalendarRange,
  switch: ToggleRight,
  upload: Upload,
  color: PaletteIcon,
  editor: PenLine,
  array: Table,
  relation: Link2,
  section: Heading,
  divider: Minus,
};

function PaletteItem({ kind, label, hint }: { kind: PaletteKind; label: string; hint: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${kind}` });
  const Icon = PALETTE_ICONS[kind];
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 hover:border-primary ${isDragging ? 'opacity-50' : ''}`}
      title={hint}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </span>
    </div>
  );
}

/**
 * Deteksi tabrakan kustom: seretan dari palet memakai posisi pointer
 * (akurat untuk drop ke area kosong kanvas), seretan antar kartu kanvas
 * tetap `closestCenter` seperti sebelumnya.
 */
const formCanvasCollision: CollisionDetection = (args) => {
  if (String(args.active.id).startsWith('palette:')) {
    const pointerHits = pointerWithin(args);
    return pointerHits.length > 0 ? pointerHits : rectIntersection(args);
  }
  return closestCenter(args);
};

/**
 * Drop-zone kanvas. WAJIB di dalam <DndContext> — hook useDroppable hanya
 * terdaftar bila dipanggil sebagai descendant provider. Sebelumnya hook
 * dipanggil di root FormBuilderCanvas (di luar DndContext) sehingga
 * droppable 'form-canvas' tidak pernah terdaftar: saat kanvas kosong
 * (tanpa kartu sortable) `over` selalu null dan drop palet gagal.
 */
function CanvasDropGrid({
  activePalette,
  children,
}: {
  activePalette: PaletteKind | null;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'form-canvas' });
  return (
    <div
      ref={setNodeRef}
      id="form-canvas-drop"
      className={`relative grid grid-cols-12 field-gap rounded-xl border border-dashed bg-muted/30 p-4 transition-all ${
        activePalette ? 'min-h-[480px]' : 'min-h-40'
      } ${
        isOver && activePalette ? 'border-primary ring-1 ring-primary' : 'border-border'
      }`}
    >
      {/* Panduan grid 12 kolom bernomor (selaras padding/gap kanvas; non-interaktif). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-12 field-gap p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start justify-center rounded border border-dashed border-border/60 pt-1 text-[10px] font-medium text-muted-foreground/70"
          >
            {i + 1}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

/**
 * Gagang resize tepi kanan kartu: seret horizontal, span mengikuti grid
 * 1–12 (komit live). stopPropagation agar tak memilih/men-drag kartu.
 */
function ResizeHandle({
  span,
  onResize,
  label,
}: {
  span: number;
  onResize: (span: number) => void;
  label: string;
}) {
  const { t } = useTranslation();
  function handlePointerDown(e: React.PointerEvent<HTMLSpanElement>): void {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const card = target.closest('[data-canvas-card]') as HTMLElement | null;
    const cardWidth = card?.offsetWidth ?? 0;
    const perSpan = cardWidth > 0 && span > 0 ? cardWidth / span : 0;
    const startX = e.clientX;
    let current = span;
    function move(ev: PointerEvent): void {
      if (perSpan <= 0) return;
      const next = Math.min(12, Math.max(1, Math.round(span + (ev.clientX - startX) / perSpan)));
      if (next !== current) {
        current = next;
        onResize(next);
      }
    }
    function up(): void {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    }
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={t('builder.form.resizeHandle', { label })}
      title={t('builder.form.resizeHandle', { label })}
      data-testid="canvas-resize"
      onPointerDown={handlePointerDown}
      onClick={(e) => e.stopPropagation()}
      className="flex w-3 shrink-0 cursor-ew-resize items-center justify-center rounded-r-lg text-transparent hover:bg-primary/20 hover:text-primary"
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );
}

/**
 * Kartu kanvas WYSIWYG: gagang di strip kiri + FormItem asli (tanpa aksi),
 * klik memilih, drag hanya via gagang.
 */
function FieldCanvasCard({
  item,
  field,
  selected,
  dropBefore,
  onSelect,
  onResize,
  previewDef,
}: {
  item: FormLayoutItem;
  field: GeneratorFieldConfig;
  selected: boolean;
  /** Seretan sedang di atas kartu ini → tampilkan garis indikator drop. */
  dropBefore: boolean;
  onSelect: () => void;
  onResize: (span: number) => void;
  previewDef: ModuleDefinition;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.field,
  });
  // Kartu array: konten pratinjau dibiarkan interaktif agar tombol
  // Tambah/ubah/hapus membuka modal editor baris. Klik lain menggelembung
  // ke kartu dan tetap memilih (drawer properti).
  const interactivePreview = field.type === 'formArrayField';
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${colSpanClass(item.colSpan)} ${isDragging ? 'opacity-60' : ''}`}
    >
      {dropBefore && (
        <div data-testid={`canvas-drop-line-${item.field}`} className="mb-1 h-1 rounded-full bg-primary" />
      )}
      <div
        role="button"
        tabIndex={0}
        data-testid={`canvas-card-${item.field}`}
        data-canvas-card
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect();
        }}
        className={`flex cursor-pointer items-stretch rounded-lg border bg-surface ${
          selected ? 'border-primary ring-1 ring-primary' : 'border-border'
        }`}
      >
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          data-testid={`canvas-drag-${item.field}`}
          className="flex w-8 shrink-0 cursor-grab items-center justify-center rounded-l-lg border-r border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t('builder.form.dragHint')}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <div className="relative min-w-0 flex-1 p-3">
          <div className={interactivePreview ? '' : 'pointer-events-none'}>
            {renderDynamicField(field, {
              def: previewDef,
              testPrefix: 'canvas-preview',
              optionsOf: (f) => (f.options ?? []).map((option) => ({ ...option })),
              loaderOf: (f) =>
                f.source === 'mockPagingInfinityScroll'
                  ? makeOptionsLoader(previewDef, f)
                  : f.source === 'relation'
                    ? makeRelationOptionsLoader(f)
                    : undefined,
              span: item.colSpan,
            })}
          </div>
          {/* Konten pratinjau non-interaktif: lapisan ini menangkap klik (termasuk
            tombol mati seperti Tambah) agar tetap memilih kartu. Kartu array
            dikecualikan — tombol Tambah/ubah/hapus membuka modal editor baris
            (demo pratinjau; data asli diisi di langkah Live Preview / runtime).
            Drag via gagang. */}
          {!interactivePreview && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('builder.form.selectField', { label: field.label })}
              title={t('builder.form.cardHint')}
              onClick={onSelect}
              className="absolute inset-0 h-full w-full cursor-pointer rounded-r-lg"
            />
          )}
        </div>
        <ResizeHandle span={item.colSpan} onResize={onResize} label={field.label} />
      </div>
    </div>
  );
}

function DecoCanvasCard({
  item,
  selected,
  dropBefore,
  onSelect,
  onResize,
}: {
  item: FormLayoutItem;
  selected: boolean;
  /** Seretan sedang di atas kartu ini → tampilkan garis indikator drop. */
  dropBefore: boolean;
  onSelect: () => void;
  onResize: (span: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.field,
  });
  const kind = item.kind ?? 'field';
  const { t } = useTranslation();
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${colSpanClass(item.colSpan)} ${isDragging ? 'opacity-60' : ''}`}
    >
      {dropBefore && (
        <div data-testid={`canvas-drop-line-${item.field}`} className="mb-1 h-1 rounded-full bg-primary" />
      )}
      <div
        role="button"
        tabIndex={0}
        data-testid={`canvas-card-${item.field}`}
        data-canvas-card
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onSelect();
        }}
        className={`flex cursor-pointer items-stretch rounded-lg border bg-surface ${
          selected ? 'border-primary ring-1 ring-primary' : 'border-dashed border-border'
        }`}
      >
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          data-testid={`canvas-drag-${item.field}`}
          className="flex w-8 shrink-0 cursor-grab items-center justify-center rounded-l-lg border-r border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t('builder.form.dragHint')}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 p-3">
          {kind === 'section' ? (
            <h3 className="text-base font-semibold text-foreground">
              {item.label?.trim() || 'Section'}
            </h3>
          ) : (
            <div className="flex items-center py-2">
              <hr className="w-full border-border" />
            </div>
          )}
        </div>
        <ResizeHandle span={item.colSpan} onResize={onResize} label={item.label?.trim() || kind} />
      </div>
    </div>
  );
}

/**
 * Isi drawer kartu layout (section): judul ditahan lokal, di-commit hanya
 * lewat Apply. Divider tak punya properti (lebar ikut grid kanvas).
 * Diremount per item via key.
 */
function LayoutItemDrawerContent({
  kind,
  label,
  onApply,
  onClose,
  applyRequestRef,
}: {
  kind: string;
  label: string;
  onApply: (label: string) => void;
  onClose: () => void;
  applyRequestRef: { current: (() => void) | null };
}) {
  const { t } = useTranslation();
  const [draftLabel, setDraftLabel] = useState(label);

  // Daftarkan Apply ke tombol footer (closure segar tiap render; bersih saat unmount).
  useEffect(() => {
    applyRequestRef.current = () => {
      onApply(draftLabel);
      onClose();
    };
    return () => {
      applyRequestRef.current = null;
    };
  });

  if (kind !== 'section') return null;
  return (
    <div className="flex flex-col stack-gap">
      <Card title={t('builder.form.sectionTitle')} size="sm">
        <TextField
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
        />
      </Card>
    </div>
  );
}

/**
 * Isi drawer properti field: editor penuh + layout. Diremount per field via
 * key. Semua edit ditahan lokal (draft) dan di-commit hanya lewat tombol
 * Apply — tidak ada auto-save. Tutup drawer tanpa Apply = buang draft.
 */
function FieldDrawerContent({
  field,
  definitions,
  existingNames,
  span,
  onApply,
  onRename,
  onClose,
  applyRequestRef,
}: {
  field: GeneratorFieldConfig;
  definitions: ModuleDefinition[];
  existingNames: string[];
  span?: number;
  onApply: (config: GeneratorFieldConfig) => void;
  onRename: (oldName: string, next: GeneratorFieldConfig) => void;
  onClose: () => void;
  applyRequestRef: { current: (() => void) | null };
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FieldFormValue>(() => initialFormValue(field, undefined));
  const [nameError, setNameError] = useState<string | null>(null);

  function handleFormChange(next: FieldFormValue): void {
    setForm(next);
    setNameError(null);
  }

  /** Validasi Name draft (duplikat + reserved). Blur hanya tampilkan error. */
  function validateName(): string | null {
    const pending = form.name.trim();
    if (pending === field.name) return null;
    if (!pending) {
      setNameError(t('builder.form.nameRequired'));
      return field.name;
    }
    if (isReservedFieldName(pending)) {
      setNameError(t('builder.form.nameReserved', { name: pending }));
      return field.name;
    }
    if (existingNames.includes(pending)) {
      setNameError(t('builder.form.nameDup', { name: pending }));
      return field.name;
    }
    return null;
  }

  function handleNameBlur(): void {
    validateName();
  }

  /** Commit draft ke kanvas (config + rename), lalu tutup drawer. */
  function handleApply(): void {
    if (validateName() !== null) return;
    const pending = form.name.trim();
    const config = { ...buildFieldConfig(form), name: pending || field.name };
    if (pending && pending !== field.name) onRename(field.name, config);
    else onApply({ ...config, name: field.name });
    onClose();
  }

  // Daftarkan Apply ke tombol footer (closure segar tiap render; bersih saat unmount).
  useEffect(() => {
    applyRequestRef.current = handleApply;
    return () => {
      applyRequestRef.current = null;
    };
  });

  return (
    <div className="flex flex-col stack-gap">
      {nameError && <p className="text-sm text-danger">{nameError}</p>}
      <FieldForm
        value={form}
        onChange={handleFormChange}
        definitions={definitions}
        onNameBlur={handleNameBlur}
        lockType
        span={span}
      />
    </div>
  );
}

function FormBuilderCanvas({
  fields,
  onFieldsChange,
  layout,
  onChange,
  previewTitle,
  definitions,
  sampleRows,
  onSampleRowsChange,
}: FormBuilderCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Apply milik konten drawer properti; tombol footer memanggilnya. */
  const applyRequestRef = useRef<(() => void) | null>(null);
  /** Dialog konfirmasi reset seluruh kanvas. */
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  /** Kind palet yang sedang diseret (ghost overlay); null = drag kanvas/batal. */
  const [activePalette, setActivePalette] = useState<PaletteKind | null>(null);
  /** Id kartu kanvas yang sedang di-over seretan (garis indikator drop). */
  const [overId, setOverId] = useState<string | null>(null);
  /** Id kartu kanvas yang sedang diseret (garis tidak tampil di kartu sendiri). */
  const [activeSortId, setActiveSortId] = useState<string | null>(null);
  /** Kata kunci pencarian palet komponen. */
  const [paletteQuery, setPaletteQuery] = useState('');
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(CanvasPointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const paletteDownAt = useRef<{ x: number; y: number } | null>(null);

  function paletteText(kind: PaletteKind): { label: string; hint: string } {
    return {
      label: t(`builder.palette.${kind}`),
      hint: t(`builder.palette.${kind}Hint`),
    };
  }

  /** Seksi palet tersaring kata kunci (label + hint, case-insensitive). */
  const visiblePaletteSections = useMemo(() => {
    const query = paletteQuery.trim().toLowerCase();
    if (!query) return PALETTE_SECTIONS;
    return PALETTE_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((kind) => {
        const { label, hint } = paletteText(kind);
        return label.toLowerCase().includes(query) || hint.toLowerCase().includes(query);
      }),
    })).filter((section) => section.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteQuery]);

  const effective = useMemo(
    () => normalizeLayout(layout ?? defaultLayoutForFields(fields), fields.map((f) => f.name)),
    [layout, fields],
  );
  const byName = useMemo(() => new Map(fields.map((field) => [field.name, field])), [fields]);
  const formItems = useMemo(
    () => [...effective.form].sort((a, b) => a.order - b.order),
    [effective],
  );
  const selectedItem = formItems.find((item) => item.field === selectedId) ?? null;
  const selectedField = selectedItem ? byName.get(selectedItem.field) : undefined;
  const drawerOpen = selectedItem !== null;

  /** Config field baru dari palet: nama otomatis terisi dari label. */
  function configForKind(kind: PaletteKind, existingNames: string[]): GeneratorFieldConfig {
    const preset = presetForKind(kind);
    const base = deriveFieldNaming(preset.label ?? kind).name || kind;
    const name = uniqueFieldName(base, existingNames);
    const config = buildFieldConfig({ ...initialFormValue(null, preset), name });
    // Array butuh minimal satu kolom agar bisa dipratinjau & lolos validasi publish.
    if (config.type === 'formArrayField' && (config.subFields ?? []).length === 0) {
      config.subFields = [
        {
          name: 'item',
          label: 'Item',
          type: 'textField',
          rules: [],
          source: 'none',
          sortable: false,
          filterable: false,
          filterCriteria: null,
        },
      ];
    }
    return config;
  }

  function addFromPalette(kind: PaletteKind, insertBefore: string | null = null): void {
    if (kind === 'section' || kind === 'divider') {
      let next = addFormItem(effective, kind);
      const added = next.form[next.form.length - 1];
      if (added && insertBefore) next = moveFormItem(next, added.field, insertBefore);
      onChange(next);
      if (added) setSelectedId(added.field);
      return;
    }
    const config = configForKind(kind, fields.map((f) => f.name));
    const next = [...fields, config];
    onFieldsChange(next);
    let layoutNext = normalizeLayout(effective, next.map((f) => f.name));
    if (insertBefore) layoutNext = moveFormItem(layoutNext, config.name, insertBefore);
    onChange(layoutNext);
    setSelectedId(config.name);
  }

  function handleDragStart(event: DragStartEvent): void {
    const activeId = String(event.active.id);
    setActivePalette(
      activeId.startsWith('palette:')
        ? (activeId.slice('palette:'.length) as PaletteKind)
        : null,
    );
    setActiveSortId(activeId.startsWith('palette:') ? null : activeId);
    setOverId(null);
  }

  function handleDragOver(event: { over: { id: string | number } | null }): void {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    setActivePalette(null);
    setActiveSortId(null);
    setOverId(null);
    const activeId = String(active.id);
    const isPalette = activeId.startsWith('palette:');
    const paletteKind = isPalette
      ? (activeId.slice('palette:'.length) as PaletteKind)
      : null;
    // Fallback: bila `over` null (rect droppable basi / collision luput),
    // cek manual apakah rect drag beririsan dengan area kanvas.
    if (!over) {
      if (!isPalette || !paletteKind) return;
      const translated = event.active.rect.current.translated;
      const canvasEl = document.getElementById('form-canvas-drop');
      if (translated && canvasEl) {
        const cr = canvasEl.getBoundingClientRect();
        const intersects = !(
          translated.right < cr.left ||
          translated.left > cr.right ||
          translated.bottom < cr.top ||
          translated.top > cr.bottom
        );
        if (intersects) addFromPalette(paletteKind);
      }
      return;
    }
    if (isPalette && paletteKind) {
      addFromPalette(
        paletteKind,
        over.id === 'form-canvas' ? null : String(over.id),
      );
      return;
    }
    if (activeId === over.id) return;
    if (over.id === 'form-canvas') return;
    onChange(moveFormItem(effective, activeId, String(over.id)));
  }

  function handleDeleteField(field: GeneratorFieldConfig): void {
    const next = fields.filter((f) => f !== field);
    onFieldsChange(next);
    onChange(
      normalizeLayout(
        { ...effective, form: effective.form.filter((item) => item.field !== field.name) },
        next.map((f) => f.name),
      ),
    );
    if (selectedId === field.name) setSelectedId(null);
  }

  function handlePanelApply(config: GeneratorFieldConfig): void {
    onFieldsChange(fields.map((f) => (f.name === config.name ? config : f)));
  }

  function handleRename(oldName: string, next: GeneratorFieldConfig): void {
    onFieldsChange(fields.map((f) => (f.name === oldName ? next : f)));
    onChange(
      normalizeLayout(
        renameFieldInLayout(effective, oldName, next.name),
        fields.map((f) => (f.name === oldName ? next.name : f.name)),
      ),
    );
    onSampleRowsChange(
      sampleRows.map((row) => {
        if (!(oldName in row)) return row;
        const remapped: DynamicListItem = { ...row, [next.name]: row[oldName] };
        delete remapped[oldName];
        return remapped;
      }),
    );
    setSelectedId(next.name);
  }

  function handleDeleteSelected(): void {
    if (selectedField) {
      handleDeleteField(selectedField);
      return;
    }
    if (selectedItem) {
      onChange(removeFormItem(effective, selectedItem.field));
      setSelectedId(null);
    }
  }

  /** Kosongkan seluruh kanvas: fields + layout form + data contoh terkait. */
  function handleResetAll(): void {
    onFieldsChange([]);
    onChange(normalizeLayout({ form: [], table: { order: [], hidden: [] } }, []));
    onSampleRowsChange([]);
    setSelectedId(null);
    setShowResetConfirm(false);
  }

  // Hapus kartu terseleksi via keyboard Delete/Backspace. Diabaikan saat
  // fokus di input editable (drawer properti, text field, editor, dialog)
  // agar tidak menghapus saat pengguna sedang mengetik.
  useEffect(() => {
    if (selectedItem === null || showResetConfirm) return;
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false;
      const el = target instanceof HTMLElement ? target : target as Element;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el instanceof HTMLElement && el.isContentEditable) return true;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return true;
      return false;
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(document.activeElement) || isEditableTarget(e.target)) return;
      e.preventDefault();
      handleDeleteSelected();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selectedItem, showResetConfirm]);

  const previewDef: ModuleDefinition = useMemo(
    () => ({
      version: 1,
      key: 'preview',
      label: 'Preview',
      singularLabel: previewTitle || 'Preview',
      parent: null,
      routeBase: 'preview',
      permissionKey: 'preview',
      apiPlural: 'previews',
      moduleType: 'crud',
      features: {
        list: true,
        detail: true,
        create: true,
        edit: true,
        delete: true,
        bulkUpload: true,
        export: true,
      },
      fields,
      layout: effective,
      deleteMode: 'soft',
      status: 'draft',
    }),
    [fields, effective, previewTitle],
  );
  return (
    <div className="flex flex-col section-gap">
      <div>
        <DndContext
          sensors={sensors}
          collisionDetection={formCanvasCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActivePalette(null);
            setActiveSortId(null);
            setOverId(null);
          }}
        >
          <DragOverlay dropAnimation={null}>
            {activePalette ? (
              <div className="cursor-grabbing rounded-lg border border-primary bg-surface px-2 py-1.5 opacity-90 shadow-lg">
                <p className="text-xs font-medium text-foreground">+ {t(`builder.palette.${activePalette}`)}</p>
                <p className="text-xs text-muted-foreground">{t('builder.form.dragToCanvas')}</p>
              </div>
            ) : null}
          </DragOverlay>
          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="min-h-0 xl:sticky xl:top-0 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pb-1 xl:pr-1">
              <div className="xl:sticky xl:top-0 xl:z-10 xl:bg-background/95 xl:py-1 xl:backdrop-blur">
                <p className="mb-2 text-sm font-medium text-foreground">{t('builder.form.palette')}</p>
                <div className="mb-2">
                  <TextField
                    size="sm"
                    value={paletteQuery}
                    onChange={(e) => setPaletteQuery(e.target.value)}
                    placeholder={t('builder.form.searchPh')}
                    data-testid="palette-search"
                  />
                </div>
              </div>
              <div className="flex flex-col stack-gap">
                {visiblePaletteSections.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t('builder.form.noMatch')}
                  </p>
                )}
                {visiblePaletteSections.map((section) => (
                  <div key={section.titleKey}>
                    <p className="mb-2 text-sm font-semibold text-foreground">{t(section.titleKey)}</p>
                    <div className="flex flex-col field-gap">
                      {section.items.map((kind) => {
                        const { label, hint } = paletteText(kind);
                        return (
                          <div
                            key={kind}
                            onPointerDown={(e) =>
                              (paletteDownAt.current = { x: e.clientX, y: e.clientY })
                            }
                            onClick={(e) => {
                              // Abaikan klik yang mengakhiri drag (drop sudah menambah).
                              const down = paletteDownAt.current;
                              paletteDownAt.current = null;
                              if (
                                down &&
                                Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4
                              ) {
                                return;
                              }
                              addFromPalette(kind);
                            }}
                          >
                            <PaletteItem kind={kind} label={label} hint={hint} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur">
                <Alert
                  variant="info"
                  message={t('builder.form.hint')}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{t('builder.form.canvasTitle')}</p>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={formItems.length === 0}
                  icon={<Trash2 className="h-4 w-4" />}
                  testId="canvas-reset"
                  title={t('builder.form.resetTitle')}
                >
                  {t('builder.form.reset')}
                </Button>
                </div>
              </div>
              <SortableContext
                items={formItems.map((item) => item.field)}
                strategy={rectSortingStrategy}
              >
                <FormGroup defaultValues={{}} onSubmit={() => {}}>
                  <CanvasDropGrid activePalette={activePalette}>
                    {formItems.length === 0 && (
                      <p className="col-span-12 py-8 text-center text-sm text-muted-foreground">
                        {t('builder.form.canvasEmpty')}
                      </p>
                    )}
                    {formItems.map((item) => {
                      const field = byName.get(item.field);
                      const dropBefore = overId === item.field && activeSortId !== item.field;
                      if ((item.kind ?? 'field') !== 'field' || !field) {
                        return (
                          <DecoCanvasCard
                            key={item.field}
                            item={item}
                            selected={selectedId === item.field}
                            dropBefore={dropBefore}
                            onSelect={() => setSelectedId(item.field)}
                            onResize={(span) => onChange(setFormSpan(effective, item.field, span))}
                          />
                        );
                      }
                      return (
                        <FieldCanvasCard
                          key={item.field}
                          item={item}
                          field={field}
                          selected={selectedId === item.field}
                          dropBefore={dropBefore}
                          onSelect={() => setSelectedId(item.field)}
                          onResize={(span) => onChange(setFormSpan(effective, item.field, span))}
                          previewDef={previewDef}
                        />
                      );
                    })}
                  </CanvasDropGrid>
                </FormGroup>
              </SortableContext>
            </div>
          </div>
        </DndContext>
      </div>

      <Drawer
        open={drawerOpen}
        // Tanpa Apply = buang draft; tidak ada commit saat tutup.
        // Terkunci: klik di luar panel tidak menutup (hindari draft hilang).
        onClose={() => setSelectedId(null)}
        title={t('builder.form.properties')}
        width="md"
        modal={false}
        closeOnBackdropClick={false}
        testId="property-drawer"
        footer={
          <div className="flex w-full items-center gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteSelected}
              testId="property-delete"
              icon={<Trash2 className="h-4 w-4" />}
              title={t('common.delete')}
              aria-label={t('common.delete')}
            />
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => applyRequestRef.current?.()}
              testId="property-apply"
            >
              {t('common.apply')}
            </Button>
          </div>
        }
      >
        {selectedItem && selectedField && (
          <FieldDrawerContent
            key={selectedField.name}
            field={selectedField}
            definitions={definitions}
            existingNames={fields.filter((f) => f !== selectedField).map((f) => f.name)}
            span={selectedItem.colSpan}
            onApply={handlePanelApply}
            onRename={handleRename}
            onClose={() => setSelectedId(null)}
            applyRequestRef={applyRequestRef}
          />
        )}
        {selectedItem && !selectedField && (
          <LayoutItemDrawerContent
            key={selectedItem.field}
            kind={selectedItem.kind ?? 'field'}
            label={selectedItem.label ?? ''}
            onApply={(label) => {
              onChange(setFormItemLabel(effective, selectedItem.field, label));
            }}
            onClose={() => setSelectedId(null)}
            applyRequestRef={applyRequestRef}
          />
        )}
      </Drawer>

      <Dialog
        testId="canvas-reset-dialog"
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title={t('builder.form.resetTitle')}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleResetAll} icon={<Trash2 className="h-4 w-4" />}>{t('builder.form.resetConfirm')}</Button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {t('builder.form.resetBody')}
        </p>
      </Dialog>

    </div>
  );
}

export default FormBuilderCanvas;
