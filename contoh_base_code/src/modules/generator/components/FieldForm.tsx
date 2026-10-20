import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CheckboxField,
  Dialog,
  SelectField,
  TextAreaField,
  TextField,
} from '../../../shared/components/ui';
import { Link2, Pencil, Trash2 } from 'lucide-react';
import type {
  ApiSourceConfig,
  DataSource,
  FieldComponentProps,
  FieldOption,
  FieldSize,
  FieldType,
  FilterCriteria,
  GeneratorFieldConfig,
  RelationConfig,
} from '../types';
import { pruneComponentProps, resolveFormItemLayout } from '../componentProps';
import type { ModuleDefinition } from '../definitions';
import {
  criteriaForFieldType,
  dataSourceRegistry,
  defaultCriteria,
  defaultFilterable,
  defaultSortable,
  defaultRuleArg,
  fieldTypeOptions,
  fieldTypeRegistry,
  pruneRulesForType,
  rulesForFieldType,
  validationRegistry,
  validationRuleNames,
} from '../registry';
import { deriveFieldNaming, isReservedFieldName } from '../parser';
import type { ValidationRuleName } from '../registry';

/** Nilai form field: semua attr editable + default terisi (tanpa optional). */
export interface FieldFormValue {
  label: string;
  name: string;
  type: FieldType;
  rules: string[];
  /** undefined = ikut default tipe (defaultSortable/defaultFilterable). */
  sortable: boolean | undefined;
  filterable: boolean | undefined;
  filterCriteria: FilterCriteria | null;
  source: DataSource;
  options: FieldOption[];
  api: Required<ApiSourceConfig>;
  relation: { definitionKey: string; labelField: string; valueField: string; apiPlural?: string };
  placeholder: string;
  disabled: boolean;
  /** String mentah input angka ('' = default). */
  rows: string;
  accept: string;
  /** Props komponen + FormItem (per tipe). */
  props: FieldComponentProps;
  /** Draft sub-field kolom (formArrayField). */
  subFields: SubFieldDraft[];
}

/** Satu sub-field kolom array: paritas penuh dengan parent (rules + source + tampilan + props). */
export interface SubFieldDraft {
  label: string;
  name: string;
  type: FieldType;
  /** Rules penuh seperti parent (`required|min:3|...`). */
  rules: string[];
  source: DataSource;
  options: FieldOption[];
  api: Required<ApiSourceConfig>;
  relation: { definitionKey: string; labelField: string; valueField: string; apiPlural?: string };
  placeholder: string;
  disabled: boolean;
  /** String mentah input angka ('' = default). */
  rows: string;
  accept: string;
  /** Props komponen + FormItem (layout vertical, dsb.) — diedit via modal. */
  props: FieldComponentProps;
}

/** Draft kosong untuk tambah kolom baru via modal. */
function blankSubDraft(): SubFieldDraft {
  return {
    label: '',
    name: '',
    type: 'textField',
    rules: [],
    source: 'none',
    options: [],
    api: { endpoint: '', method: 'GET', valueField: 'value', labelField: 'label' },
    relation: { definitionKey: '', labelField: '', valueField: 'id' },
    placeholder: '',
    disabled: false,
    rows: '',
    accept: '',
    props: {},
  };
}

/** Sub draft → nilai FieldForm agar bisa diedit penuh di modal. */
function subToFormValue(sub: SubFieldDraft): FieldFormValue {
  return {
    label: sub.label,
    name: sub.name,
    type: sub.type,
    rules: [...sub.rules],
    sortable: false,
    filterable: false,
    filterCriteria: null,
    source: sub.source,
    options: sub.options.map((o) => ({ ...o })),
    api: { ...sub.api },
    relation: { ...sub.relation },
    placeholder: sub.placeholder,
    disabled: sub.disabled,
    rows: sub.rows,
    accept: sub.accept,
    props: structuredClone(sub.props),
    subFields: [],
  };
}

/** Nilai FieldForm modal → patch sub draft. */
function formValueToSub(form: FieldFormValue): SubFieldDraft {
  return {
    label: form.label,
    name: form.name,
    type: form.type,
    rules: [...form.rules],
    source: form.source,
    options: form.options.map((o) => ({ ...o })),
    api: { ...form.api },
    relation: { ...form.relation },
    placeholder: form.placeholder,
    disabled: form.disabled,
    rows: form.rows,
    accept: form.accept,
    props: form.props ? structuredClone(form.props) : {},
  };
}

function configToSubDraft(sub: GeneratorFieldConfig): SubFieldDraft {
  return {
    label: sub.label,
    name: sub.name,
    type: sub.type,
    rules: [...sub.rules],
    source: sub.source,
    options: (sub.options ?? []).map((o) => ({ ...o })),
    api: {
      endpoint: sub.api?.endpoint ?? '',
      method: sub.api?.method ?? 'GET',
      valueField: sub.api?.valueField ?? 'value',
      labelField: sub.api?.labelField ?? 'label',
    },
    relation: {
      definitionKey: sub.relation?.definitionKey ?? '',
      labelField: sub.relation?.labelField ?? '',
      valueField: sub.relation?.valueField ?? 'id',
      ...(sub.relation?.apiPlural ? { apiPlural: sub.relation.apiPlural } : {}),
    },
    placeholder: sub.placeholder ?? '',
    disabled: sub.disabled ?? false,
    rows: sub.rows ? String(sub.rows) : '',
    accept: sub.accept ?? '',
    props: sub.componentProps ? structuredClone(sub.componentProps) : {},
  };
}

function subDraftToConfig(sub: SubFieldDraft): GeneratorFieldConfig {
  const allowed = (Object.keys(dataSourceRegistry) as DataSource[]).filter((key) =>
    dataSourceRegistry[key].appliesTo.includes(sub.type),
  );
  const source = allowed.includes(sub.source) ? sub.source : 'none';
  const rows = Number.parseInt(sub.rows, 10);
  const prunedProps = pruneComponentProps(sub.type, sub.props);
  return {
    name: sub.name,
    label: sub.label.trim(),
    type: sub.type,
    rules: [...sub.rules],
    source,
    ...(source === 'mockStatic' || source === 'api' ? { options: sub.options } : {}),
    ...(source === 'api'
      ? {
          api: {
            endpoint: sub.api.endpoint.trim(),
            method: sub.api.method,
            valueField: sub.api.valueField,
            labelField: sub.api.labelField,
          },
        }
      : {}),
    ...(source === 'relation'
      ? {
          relation: {
            definitionKey: sub.relation.definitionKey,
            labelField: sub.relation.labelField,
            valueField: sub.relation.valueField.trim() || 'id',
            ...(sub.relation.apiPlural ? { apiPlural: sub.relation.apiPlural } : {}),
          },
        }
      : {}),
    ...(sub.placeholder.trim() ? { placeholder: sub.placeholder.trim() } : {}),
    ...(sub.disabled ? { disabled: true } : {}),
    ...(sub.type === 'textareaField' && Number.isFinite(rows) && rows > 0 ? { rows } : {}),
    ...(sub.type === 'fileUploadField' && sub.accept.trim() ? { accept: sub.accept.trim() } : {}),
    ...(prunedProps ? { componentProps: prunedProps } : {}),
    sortable: false,
    filterable: false,
    filterCriteria: null,
  };
}

export interface FieldFormPreset {
  type?: FieldType;
  source?: DataSource;
  label?: string;
}

interface RuleDraft {
  enabled: boolean;
  arg: string;
}

function rulesToDraft(rules: string[]): Record<ValidationRuleName, RuleDraft> {
  const draft = {} as Record<ValidationRuleName, RuleDraft>;
  for (const name of validationRuleNames) draft[name] = { enabled: false, arg: '' };
  for (const rule of rules) {
    const sep = rule.indexOf(':');
    const name = (sep === -1 ? rule : rule.slice(0, sep)) as ValidationRuleName;
    if (name in draft) {
      draft[name] = { enabled: true, arg: sep === -1 ? '' : rule.slice(sep + 1) };
    }
  }
  return draft;
}

function draftToRules(draft: Record<ValidationRuleName, RuleDraft>): string[] {
  const rules: string[] = [];
  for (const name of validationRuleNames) {
    const entry = draft[name];
    if (!entry.enabled) continue;
    const needsArg = validationRegistry[name].needsArg;
    // Nilai dihapus → rule ikut gugur (kondisi lama: checkbox kembali disabled).
    if (needsArg && entry.arg.trim() === '') continue;
    rules.push(needsArg ? `${name}:${entry.arg.trim()}` : name);
  }
  return rules;
}

/** Nilai eksplisit yang sama dengan default tipe → undefined (tampil "Default" di select). */
function normalizeTriDefault(value: boolean | undefined, fallback: boolean): boolean | undefined {
  const resolved = value ?? fallback;
  return resolved === fallback ? undefined : resolved;
}

/** Nilai awal form dari field existing, preset palet, atau kosong. */
export function initialFormValue(
  field: GeneratorFieldConfig | null,
  preset?: FieldFormPreset,
): FieldFormValue {
  const type = field?.type ?? preset?.type ?? 'textField';
  const source = field?.source ?? preset?.source ?? 'none';
  return {
    label: field?.label ?? preset?.label ?? '',
    name: field?.name ?? '',
    type,
    rules: field ? [...field.rules] : [],
    sortable: normalizeTriDefault(field?.sortable, defaultSortable(type)),
    filterable: normalizeTriDefault(field?.filterable, defaultFilterable(type)),
    filterCriteria: field?.filterCriteria ?? defaultCriteria(type),
    source,
    options:
      field?.options?.map((o) => ({ ...o })) ??
      (source === 'mockStatic'
        ? [
            { label: 'Option 1', value: 'option_1' },
            { label: 'Option 2', value: 'option_2' },
          ]
        : []),
    api: {
      endpoint: field?.api?.endpoint ?? '',
      method: field?.api?.method ?? 'GET',
      valueField: field?.api?.valueField ?? 'value',
      labelField: field?.api?.labelField ?? 'label',
    },
    relation: {
      definitionKey: field?.relation?.definitionKey ?? '',
      labelField: field?.relation?.labelField ?? '',
      valueField: field?.relation?.valueField ?? 'id',
      ...(field?.relation?.apiPlural ? { apiPlural: field.relation.apiPlural } : {}),
    },
    placeholder: field?.placeholder ?? '',
    disabled: field?.disabled ?? false,
    // Samakan dengan default tipe agar UI menampilkan "Default".
    // (Nilai eksplisit yang sama dengan default dinormalisasi ke undefined.)
    rows: field?.rows ? String(field.rows) : '',
    accept: field?.accept ?? '',
    props: field?.componentProps ? structuredClone(field.componentProps) : {},
    subFields: (field?.subFields ?? [])
      .filter((sub) => sub.type !== 'formArrayField')
      .map(configToSubDraft),
  };
}

/** Form → config field (buang default kosong; muatan source tak relevan ikut di-strip normalize). */
export function buildFieldConfig(form: FieldFormValue): GeneratorFieldConfig {
  const rows = Number.parseInt(form.rows, 10);
  const sortable = form.sortable ?? defaultSortable(form.type);
  const filterable = form.filterable ?? defaultFilterable(form.type);
  const prunedProps = pruneComponentProps(form.type, form.props);
  const relation: RelationConfig = {
    definitionKey: form.relation.definitionKey,
    labelField: form.relation.labelField,
    valueField: form.relation.valueField.trim() || 'id',
    ...(form.relation.apiPlural ? { apiPlural: form.relation.apiPlural } : {}),
  };
  return {
    name: form.name,
    label: form.label.trim(),
    type: form.type,
    rules: [...form.rules],
    sortable,
    filterable,
    filterCriteria: filterable ? form.filterCriteria : null,
    source: form.source,
    ...(form.source === 'mockStatic' || form.source === 'api' ? { options: form.options } : {}),
    ...(form.source === 'api'
      ? {
          api: {
            endpoint: form.api.endpoint.trim(),
            method: form.api.method,
            valueField: form.api.valueField,
            labelField: form.api.labelField,
          },
        }
      : {}),
    ...(form.source === 'relation' ? { relation } : {}),
    ...(form.placeholder.trim() ? { placeholder: form.placeholder.trim() } : {}),
    ...(form.disabled ? { disabled: true } : {}),
    ...(form.type === 'textareaField' && Number.isFinite(rows) && rows > 0 ? { rows } : {}),
    ...(form.type === 'fileUploadField' && form.accept.trim() ? { accept: form.accept.trim() } : {}),
    ...(form.type === 'formArrayField' ? { subFields: form.subFields.map(subDraftToConfig) } : {}),
    ...(prunedProps ? { componentProps: prunedProps } : {}),
  };
}

const PLACEHOLDER_TYPES: FieldType[] = [
  'textField',
  'textareaField',
  'passwordField',
  'numberField',
  'currencyField',
  'dateField',
  'dateRangeField',
  'selectField',
  'selectMultipleField',
];
/** Label komponen untuk judul Props — 3 tipe berprosa diterjemahkan, sisanya nama komponen. */
function componentLabel(t: (key: string) => string, type: FieldType): string {
  switch (type) {
    case 'numberField':
      return t('field.compNumber');
    case 'currencyField':
      return t('field.compCurrency');
    default:
      return fieldTypeRegistry[type].component;
  }
}

function boolOptions(t: (key: string) => string): { label: string; value: string }[] {
  return [
    { label: t('field.yes'), value: 'true' },
    { label: t('field.no'), value: 'false' },
  ];
}

/**
 * Pilihan boolean Ya / Tidak: nilai default (tak di-set) langsung tampil
 * terpilih sesuai `defaultValue`, tapi tetap tak disimpan sampai pengguna
 * mengubahnya (prune membuang undefined).
 */
function TriState({
  label,
  value,
  defaultValue = false,
  onChange,
  hint,
}: {
  label: string;
  value: boolean | undefined;
  /** Nilai yang tampil terpilih saat `value` tak di-set. */
  defaultValue?: boolean;
  onChange: (next: boolean | undefined) => void;
  hint?: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="mb-1 block font-mono text-xs text-muted-foreground">{label}</label>
      <SelectField size="sm"
        value={(value ?? defaultValue) ? 'true' : 'false'}
        onChange={(next) => onChange(next === 'true')}
        options={boolOptions(t)}
        clearable={false}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SizeSelect({
  value,
  onChange,
}: {
  value: FieldSize | undefined;
  onChange: (next: FieldSize | undefined) => void;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-xs text-muted-foreground">size</label>
      <SelectField size="sm"
        value={value ?? 'md'}
        onChange={(next) => onChange(next as FieldSize)}
        options={[
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' },
        ]}
        clearable={false}
      />
    </div>
  );
}

function PropText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-xs text-muted-foreground">{label}</label>
      <TextField size="sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function PropNumber({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-xs text-muted-foreground">{label}</label>
      <TextField size="sm"
        value={value ? String(value) : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '');
          onChange(digits === '' ? undefined : Number(digits));
        }}
        placeholder={placeholder}
        maxLength={5}
      />
    </div>
  );
}

interface FieldFormProps {
  value: FieldFormValue;
  onChange: (value: FieldFormValue) => void;
  /** Definisi terdaftar untuk picker target relasi. */
  definitions: ModuleDefinition[];
  /** Dipanggil saat input Name kehilangan fokus (drawer pakai untuk validasi awal; commit via Apply). */
  onNameBlur?: () => void;
  /** Sembunyikan kartu Tabel & Filter (untuk editor sub-field di modal). */
  hideTableFilter?: boolean;
  /** Kunci pilihan tipe field (drawer properti field yang sudah ada). */
  lockType?: boolean;
  /** Span grid kanvas (1–12) — untuk menampilkan default layout yang benar. */
  span?: number;
}

/**
 * Editor daftar rule validasi — dipakai parent field maupun sub-field kolom
 * sehingga perilakunya paritas penuh (checkbox + argumen auto-default).
 */
function ValidationEditor({
  rules,
  fieldType,
  onChange,
}: {
  rules: string[];
  /** Hanya rule yang berlaku untuk tipe ini yang ditampilkan. */
  fieldType: FieldType;
  onChange: (rules: string[]) => void;
}) {
  const { t } = useTranslation();
  // Argumen terakhir per rule agar enable ulang memakai nilai sebelumnya.
  const lastArgsRef = useRef<Partial<Record<ValidationRuleName, string>>>({});
  // Draft lokal mengikuti rules prop; tiap edit langsung commit ke parent —
  // nilai yang dikosongkan menggugurkan rule (checkbox disabled).
  const [draft, setDraftLocal] = useState<Record<ValidationRuleName, RuleDraft>>(() =>
    rulesToDraft(rules),
  );
  // Sinkron saat field/sub berbeda dimuat (parent tak selalu remount).
  const rulesKey = rules.join('|');
  const [lastRulesKey, setLastRulesKey] = useState(rulesKey);
  if (rulesKey !== lastRulesKey) {
    setLastRulesKey(rulesKey);
    setDraftLocal(rulesToDraft(rules));
  }

  /** Centang/hapus rule (langsung commit). Enable mengisi nilai bawaan bila kosong. */
  function setEnabled(ruleName: ValidationRuleName, enabled: boolean): void {
    const current = draft[ruleName];
    const needsArg = validationRegistry[ruleName].needsArg;
    const arg = needsArg
      ? current.arg.trim() || lastArgsRef.current[ruleName] || defaultRuleArg(ruleName)
      : '';
    if (needsArg && arg.trim()) lastArgsRef.current[ruleName] = arg.trim();
    const next = { ...draft, [ruleName]: { enabled, arg } };
    setDraftLocal(next);
    onChange(draftToRules(next));
  }

  /** Isi nilai rule (langsung commit). Nilai dihapus → centang ikut mati. */
  function setArg(ruleName: ValidationRuleName, arg: string): void {
    if (arg.trim()) lastArgsRef.current[ruleName] = arg.trim();
    const needsArg = validationRegistry[ruleName].needsArg;
    const cleared = needsArg && arg.trim() === '';
    const next = {
      ...draft,
      [ruleName]: { ...draft[ruleName], arg, ...(cleared ? { enabled: false } : {}) },
    };
    setDraftLocal(next);
    onChange(draftToRules(next));
  }

  return (
    <div className="flex flex-col field-gap">
      <p className="text-xs text-muted-foreground">
        {t('field.validationHint')}
      </p>
      {rulesForFieldType(fieldType).map((ruleName) => {
        const def = validationRegistry[ruleName];
        const entry = draft[ruleName];
        return (
          <div
            key={ruleName}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
              entry.enabled ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <CheckboxField
              size="sm"
              value={entry.enabled}
              onChange={(checked) => setEnabled(ruleName, checked)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">{t(`registry.validationRules.${ruleName}`)}</p>
              <p className="truncate text-xs text-muted-foreground" title={t(`registry.validationRules.${ruleName}Desc`)}>
                {t(`registry.validationRules.${ruleName}Desc`)}
              </p>
            </div>
            {def.needsArg && (
              <div className="w-24 shrink-0">
                <TextField size="sm"
                  value={entry.arg}
                  onChange={(e) => setArg(ruleName, e.target.value)}
                  placeholder={def.placeholder ?? 'value'}
                  disabled={!entry.enabled}
                />
              </div>
            )}
          </div>
        );
      })}
      <p className="font-mono text-xs break-all text-muted-foreground">{draftToRules(draft).join('|') || '(no rules)'}</p>
    </div>
  );
}

export interface SourcePatch {
  source?: DataSource;
  options?: FieldOption[];
  api?: Required<ApiSourceConfig>;
  relation?: { definitionKey: string; labelField: string; valueField: string; apiPlural?: string };
}

/**
 * Editor sumber data — dipakai parent field maupun sub-field kolom sehingga
 * pilihannya paritas penuh (none/mockStatic/paging/relation/api per tipe).
 */
function SourceEditor({
  type,
  source,
  options,
  api,
  relation,
  definitions,
  onPatch,
  /** Bila true, tombol hapus option hanya ikon (tanpa label) — untuk sub-field. */
  iconOnlyRemove = false,
}: {
  type: FieldType;
  source: DataSource;
  options: FieldOption[];
  api: Required<ApiSourceConfig>;
  relation: { definitionKey: string; labelField: string; valueField: string; apiPlural?: string };
  definitions: ModuleDefinition[];
  onPatch: (part: SourcePatch) => void;
  iconOnlyRemove?: boolean;
}) {
  const { t } = useTranslation();
  const allowedSources = (Object.keys(dataSourceRegistry) as DataSource[]).filter((key) =>
    dataSourceRegistry[key].appliesTo.includes(type),
  );
  const relationTargetDef = definitions.find((d) => d.key === relation.definitionKey);

  function updateOption(index: number, optPatch: Partial<FieldOption>): void {
    onPatch({ options: options.map((opt, i) => (i === index ? { ...opt, ...optPatch } : opt)) });
  }

  return (
    <div className="flex flex-col stack-gap">
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">{t('field.source')}</label>
        <SelectField size="sm"
          value={source}
          onChange={(next) => onPatch({ source: next as DataSource })}
          options={allowedSources.map((item) => ({
            label: t(`registry.dataSources.${item}`),
            value: item,
          }))}
          clearable={false}
        />
      </div>

      {source === 'mockStatic' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">{t('field.options')}</label>
          <div className="flex flex-col field-gap">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <TextField size="sm"
                    value={opt.label}
                    onChange={(e) => updateOption(i, { label: e.target.value })}
                    placeholder={t('field.label')}
                  />
                </div>
                <div className="flex-1">
                  <TextField size="sm"
                    value={opt.value}
                    onChange={(e) => updateOption(i, { value: e.target.value })}
                    placeholder={t('field.name')}
                  />
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onPatch({ options: options.filter((_, j) => j !== i) })}
                  icon={<Trash2 className="h-4 w-4" />}
                  title={t('common.delete')}
                >
                  {iconOnlyRemove ? null : t('common.delete')}
                </Button>
              </div>
            ))}
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPatch({ options: [...options, { label: '', value: '' }] })}
              >
                {t('field.addOption')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {source === 'relation' && (
        <div className="flex flex-col field-gap">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('field.relationTarget')}</label>
            <SelectField size="sm"
              value={relation.definitionKey}
              onChange={(next) => {
                const target = definitions.find((d) => d.key === next);
                onPatch({
                  relation: {
                    ...relation,
                    definitionKey: next,
                    labelField: target?.fields.some((f) => f.name === relation.labelField)
                      ? relation.labelField
                      : '',
                    ...(target ? { apiPlural: target.apiPlural } : {}),
                  },
                });
              }}
              options={definitions.map((d) => ({ label: `${d.label} (${d.key})`, value: d.key }))}
              clearable={false}
              searchable
            />
            {definitions.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('field.noModules')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 field-gap">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('field.relationLabelField')}</label>
              <SelectField size="sm"
                value={relation.labelField}
                onChange={(next) => onPatch({ relation: { ...relation, labelField: next } })}
                options={(relationTargetDef?.fields ?? []).map((f) => ({
                  label: `${f.label} (${f.name})`,
                  value: f.name,
                }))}
                clearable={false}
                searchable
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('field.relationValueField')}</label>
              <TextField size="sm"
                value={relation.valueField}
                onChange={(e) => onPatch({ relation: { ...relation, valueField: e.target.value } })}
                placeholder="id"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('field.relationHint')}
          </p>
        </div>
      )}

      {source === 'api' && (
        <div className="flex flex-col field-gap">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('field.endpoint')}</label>
            <TextField size="sm"
              value={api.endpoint}
              onChange={(e) => onPatch({ api: { ...api, endpoint: e.target.value } })}
              placeholder="https://api.example.com/suppliers"
            />
          </div>
          <div className="grid grid-cols-3 field-gap">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('field.method')}</label>
              <TextField size="sm"
                value={api.method}
                onChange={(e) => onPatch({ api: { ...api, method: e.target.value } })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('field.relationValueField')}</label>
              <TextField size="sm"
                value={api.valueField}
                onChange={(e) => onPatch({ api: { ...api, valueField: e.target.value } })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('field.relationLabelField')}</label>
              <TextField size="sm"
                value={api.labelField}
                onChange={(e) => onPatch({ api: { ...api, labelField: e.target.value } })}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('field.apiExample')}
            </label>
            <TextAreaField size="sm"
              value={options.map((o) => `${o.label}=${o.value}`).join('\n')}
              onChange={(e) =>
                onPatch({
                  options: e.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const [optLabel, ...rest] = line.split('=');
                      return { label: optLabel.trim(), value: (rest.join('=') || optLabel).trim() };
                    }),
                })
              }
              placeholder={'PT Maju=MJU\nPT Mundur=MDR'}
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Modal editor satu sub-field kolom: FieldForm penuh (semua properti seperti
 * parent, tanpa kartu Tabel & Filter) + validasi nama saat simpan.
 * Dipakai dari daftar ringkas agar drawer parent tidak bertabrakan.
 */
function SubFieldModal({
  title,
  initial,
  siblingNames,
  definitions,
  onClose,
  onSave,
}: {
  title: string;
  initial: SubFieldDraft;
  siblingNames: string[];
  definitions: ModuleDefinition[];
  onClose: () => void;
  onSave: (next: SubFieldDraft) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FieldFormValue>(() => subToFormValue(initial));
  const [error, setError] = useState<string | null>(null);

  function handleSave(): void {
    const name = draft.name.trim();
    if (!name) {
      setError(t('configValidate.subNameRequired'));
      return;
    }
    if (isReservedFieldName(name)) {
      setError(t('configValidate.subNameReserved', { name }));
      return;
    }
    if (siblingNames.includes(name)) {
      setError(t('configValidate.subNameDup', { name }));
      return;
    }
    onSave({ ...formValueToSub(draft), name });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      maxWidth="lg"
      testId="subfield-modal"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} testId="subfield-modal-save">
            {t('common.save')}
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <FieldForm
        value={draft}
        onChange={(next) => {
          setDraft(next);
          setError(null);
        }}
        definitions={definitions}
        hideTableFilter
      />
    </Dialog>
  );
}

/**
 * Editor field terkontrol penuh — dipakai dialog tambah/edit maupun panel
 * properti kanvas. Induk remount via key tiap ganti field.
 */
function FieldForm({ value, onChange, definitions, onNameBlur, hideTableFilter = false, lockType = false, span }: FieldFormProps) {
  const [subModal, setSubModal] = useState<{ mode: 'create' } | { mode: 'edit'; index: number } | null>(null);
  const { t } = useTranslation();
  const form = value;
  const patch = (part: Partial<FieldFormValue>): void => onChange({ ...form, ...part });

  // Label terakhir yang terlihat: nama mengikuti Label selama belum diubah
  // manual — berlaku juga untuk field palet (mis. Text/text → Region Name
  // menjadi regionName). Field berbeda yang dimuat (modal sub) mulai ulang.
  const namingRef = useRef({ label: value.label, name: value.name });
  if (value.label !== namingRef.current.label && value.name !== namingRef.current.name) {
    namingRef.current = { label: value.label, name: value.name };
  }

  // Name terkunci mengikuti Label; klik ikon pensil untuk kustom manual
  // (camelCase). Klik ikon tautan untuk kembali otomatis dari Label.
  const [nameCustom, setNameCustom] = useState(false);

  function handleLabelChange(next: string): void {
    const prevDerived = deriveFieldNaming(namingRef.current.label).name;
    const follow = !nameCustom && (form.name === '' || form.name === prevDerived);
    const name = follow ? deriveFieldNaming(next).name : form.name;
    namingRef.current = { label: next, name };
    patch({ label: next, name });
  }

  function handleNameToggle(): void {
    if (nameCustom) {
      const name = deriveFieldNaming(form.label).name;
      namingRef.current = { label: form.label, name };
      patch({ name });
    }
    setNameCustom(!nameCustom);
  }

  /** Normalisasi nama kustom: alfanumerik + huruf pertama kecil (camelCase). */
  function handleCustomName(next: string): void {
    const clean = next.replace(/[^a-zA-Z0-9]/g, '');
    const name = clean ? clean.charAt(0).toLowerCase() + clean.slice(1) : '';
    namingRef.current = { label: namingRef.current.label, name };
    patch({ name });
  }

  function handleTypeChange(next: FieldType): void {
    patch({
      type: next,
      sortable: undefined,
      filterable: undefined,
      filterCriteria: defaultCriteria(next),
      source: dataSourceRegistry[form.source].appliesTo.includes(next) ? form.source : 'none',
      rules: pruneRulesForType(form.rules, next),
    });
  }

  function patchSub(index: number, part: Partial<SubFieldDraft>): void {
    patch({
      subFields: form.subFields.map((sub, i) => (i === index ? { ...sub, ...part } : sub)),
    });
  }

  function patchTypedProps(key: keyof FieldComponentProps, part: Record<string, unknown>): void {
    const current = (form.props[key] as Record<string, unknown> | undefined) ?? {};
    patch({ props: { ...form.props, [key]: { ...current, ...part } } as FieldComponentProps });
  }

  function patchFormItem(part: Record<string, unknown>): void {
    patchTypedProps('formItem', part);
  }

  /** Props terketik untuk satu kunci (default objek kosong). */
  function typedProps<K extends keyof FieldComponentProps>(
    key: K,
  ): NonNullable<FieldComponentProps[K]> {
    return (form.props[key] ?? {}) as NonNullable<FieldComponentProps[K]>;
  }

  function renderTypedProps(): ReactNode {
    switch (form.type) {
      case 'textField':
      case 'numberField':
      case 'currencyField': {
        const p = typedProps('text');
        const isCurrency = form.type === 'currencyField';
        return (
          <>
            <SizeSelect value={p.size} onChange={(size) => patchTypedProps('text', { size })} />
            <TriState
              label="clearable"
              value={p.clearable}
              onChange={(clearable) => patchTypedProps('text', { clearable })}
              hint={t('field.clearableHint')}
            />
            <PropText
              label="prefix"
              value={p.prefix ?? ''}
              onChange={(prefix) => patchTypedProps('text', { prefix })}
              placeholder={isCurrency ? t('field.prefixRpDefault') : 'Rp'}
            />
            <PropText
              label="suffix"
              value={p.suffix ?? ''}
              onChange={(suffix) => patchTypedProps('text', { suffix })}
              placeholder="Kg"
            />
            {isCurrency && (
              <p className="text-xs text-muted-foreground">
                Selalu format currency; simbol prefix default Rp bila dikosongkan.
              </p>
            )}
          </>
        );
      }
      case 'textareaField': {
        const p = typedProps('textarea');
        return (
          <SizeSelect
            value={p.size}
            onChange={(size) => patchTypedProps('textarea', { size })}
          />
        );
      }
      case 'passwordField': {
        const p = typedProps('password');
        return (
          <>
            <SizeSelect
              value={p.size}
              onChange={(size) => patchTypedProps('password', { size })}
            />
            <TriState
              label="defaultVisible"
              value={p.defaultVisible}
              onChange={(defaultVisible) => patchTypedProps('password', { defaultVisible })}
              hint={t('field.passwordVisible')}
            />
          </>
        );
      }
      case 'dateField': {
        const p = typedProps('date');
        return (
          <>
            <SizeSelect value={p.size} onChange={(size) => patchTypedProps('date', { size })} />
            <TriState
              label="showTime"
              value={p.showTime}
              onChange={(showTime) => patchTypedProps('date', { showTime })}
              hint={t('field.dateTime')}
            />
            <TriState
              label="clearable"
              value={p.clearable}
              defaultValue
              onChange={(clearable) => patchTypedProps('date', { clearable })}
              hint={t('field.dateClearable')}
            />
            <PropText
              label="minDate"
              value={p.minDate ?? ''}
              onChange={(minDate) => patchTypedProps('date', { minDate })}
              placeholder="2026-01-01"
            />
            <PropText
              label="maxDate"
              value={p.maxDate ?? ''}
              onChange={(maxDate) => patchTypedProps('date', { maxDate })}
              placeholder="2026-12-31"
            />
          </>
        );
      }
      case 'dateRangeField': {
        const p = typedProps('dateRange');
        return (
          <>
            <SizeSelect
              value={p.size}
              onChange={(size) => patchTypedProps('dateRange', { size })}
            />
            <PropText
              label="maxDate"
              value={p.maxDate ?? ''}
              onChange={(maxDate) => patchTypedProps('dateRange', { maxDate })}
              placeholder="2026-12-31"
            />
            <PropNumber
              label="maxRangeDays"
              value={p.maxRangeDays}
              onChange={(maxRangeDays) => patchTypedProps('dateRange', { maxRangeDays })}
              placeholder={t('field.maxDaysPh')}
            />
          </>
        );
      }
      case 'selectField': {
        const p = typedProps('select');
        return (
          <>
            <SizeSelect value={p.size} onChange={(size) => patchTypedProps('select', { size })} />
            <TriState
              label="clearable"
              value={p.clearable}
              defaultValue
              onChange={(clearable) => patchTypedProps('select', { clearable })}
              hint={t('field.selectClearable')}
            />
            <TriState
              label="searchable"
              value={p.searchable}
              onChange={(searchable) => patchTypedProps('select', { searchable })}
              hint={t('field.selectSearchable')}
            />
          </>
        );
      }
      case 'selectMultipleField': {
        const p = typedProps('selectMultiple');
        return (
          <>
            <SizeSelect
              value={p.size}
              onChange={(size) => patchTypedProps('selectMultiple', { size })}
            />
            <TriState
              label="clearable"
              value={p.clearable}
              defaultValue
              onChange={(clearable) => patchTypedProps('selectMultiple', { clearable })}
            />
            <TriState
              label="searchable"
              value={p.searchable}
              onChange={(searchable) => patchTypedProps('selectMultiple', { searchable })}
              hint={t('field.selectSearchable')}
            />
          </>
        );
      }
      case 'radioGroupField': {
        const p = typedProps('radio');
        return (
          <SizeSelect value={p.size} onChange={(size) => patchTypedProps('radio', { size })} />
        );
      }
      case 'checkboxField': {
        const p = typedProps('checkbox');
        return (
          <>
            <SizeSelect
              value={p.size}
              onChange={(size) => patchTypedProps('checkbox', { size })}
            />
            <TriState
              label="indeterminate"
              value={p.indeterminate}
              onChange={(indeterminate) => patchTypedProps('checkbox', { indeterminate })}
              hint={t('field.checkboxIndeterminate')}
            />
          </>
        );
      }
      case 'checkboxGroupField': {
        const p = typedProps('checkboxGroup');
        return (
          <SizeSelect
            value={p.size}
            onChange={(size) => patchTypedProps('checkboxGroup', { size })}
          />
        );
      }
      case 'switchField': {
        const p = typedProps('switch');
        return (
          <>
            <SizeSelect value={p.size} onChange={(size) => patchTypedProps('switch', { size })} />
            <TriState
              label="showCheckedLabels"
              value={p.showCheckedLabels}
              defaultValue
              onChange={(showCheckedLabels) => patchTypedProps('switch', { showCheckedLabels })}
              hint={t('field.switchStatic')}
            />
            <PropText
              label="checkedLabel"
              value={p.checkedLabel ?? ''}
              onChange={(checkedLabel) => patchTypedProps('switch', { checkedLabel })}
              placeholder={t('field.yes')}
            />
            <PropText
              label="uncheckedLabel"
              value={p.uncheckedLabel ?? ''}
              onChange={(uncheckedLabel) => patchTypedProps('switch', { uncheckedLabel })}
              placeholder={t('field.no')}
            />
          </>
        );
      }
      case 'fileUploadField': {
        const p = typedProps('upload');
        return (
          <>
            <SizeSelect value={p.size} onChange={(size) => patchTypedProps('upload', { size })} />
            <TriState
              label="multiple"
              value={p.multiple}
              onChange={(multiple) => patchTypedProps('upload', { multiple })}
              hint={t('field.uploadMultiple')}
            />
          </>
        );
      }
      case 'colorField': {
        const p = typedProps('color');
        return (
          <SizeSelect value={p.size} onChange={(size) => patchTypedProps('color', { size })} />
        );
      }
      case 'editorField': {
        const p = typedProps('editor');
        return (
          <SizeSelect value={p.size} onChange={(size) => patchTypedProps('editor', { size })} />
        );
      }
      case 'formArrayField': {
        const p = typedProps('array');
        return (
          <>
            <SizeSelect value={p.size} onChange={(size) => patchTypedProps('array', { size })} />
            <PropText
              label="addLabel"
              value={p.addLabel ?? ''}
              onChange={(addLabel) => patchTypedProps('array', { addLabel })}
              placeholder={t('field.arrayAddLabelPh')}
            />
            <PropText
              label="editorTitle"
              value={p.editorTitle ?? ''}
              onChange={(editorTitle) => patchTypedProps('array', { editorTitle })}
              placeholder={t('field.placeholderAuto')}
            />
            <PropText
              label="emptyTitle"
              value={p.emptyTitle ?? ''}
              onChange={(emptyTitle) => patchTypedProps('array', { emptyTitle })}
              placeholder={t('field.arrayEmptyTitlePh')}
            />
            <PropText
              label="emptyDescription"
              value={p.emptyDescription ?? ''}
              onChange={(emptyDescription) => patchTypedProps('array', { emptyDescription })}
              placeholder={t('field.arrayEmptyDescPh')}
            />
            <PropNumber
              label="maxRows"
              value={p.maxRows}
              onChange={(maxRows) => patchTypedProps('array', { maxRows })}
              placeholder={t('field.arrayNoLimit')}
            />
            <TriState
              label="lockFirstRow"
              value={p.lockFirstRow}
              onChange={(lockFirstRow) => patchTypedProps('array', { lockFirstRow })}
              hint={t('field.lockFirstRowHint')}
            />
          </>
        );
      }
    }
  }

  /** Props teknis (paginate, pageSize, tampilan lanjutan) — tampil di tab Advanced. */
  function renderAdvancedTypedProps(): ReactNode {
    switch (form.type) {
      case 'selectField': {
        const p = typedProps('select');
        return (
          <>
            <TriState
              label="paginateOnScroll"
              value={p.paginateOnScroll}
              onChange={(paginateOnScroll) => patchTypedProps('select', { paginateOnScroll })}
              hint={t('field.selectPaginate')}
            />
            <PropNumber
              label="pageSize"
              value={p.pageSize}
              onChange={(pageSize) => patchTypedProps('select', { pageSize })}
              placeholder="20"
            />
            <PropText
              label="emptyOptionsText"
              value={p.emptyOptionsText ?? ''}
              onChange={(emptyOptionsText) => patchTypedProps('select', { emptyOptionsText })}
              placeholder={t('fields.noOptions')}
            />
            <TriState
              label="showSelectedOptions"
              value={p.showSelectedOptions}
              defaultValue
              onChange={(showSelectedOptions) =>
                patchTypedProps('select', { showSelectedOptions })
              }
            />
            <TriState
              label="showValueOnly"
              value={p.showValueOnly}
              onChange={(showValueOnly) => patchTypedProps('select', { showValueOnly })}
              hint={t('field.selectValueOnly')}
            />
          </>
        );
      }
      case 'selectMultipleField': {
        const p = typedProps('selectMultiple');
        return (
          <>
            <TriState
              label="paginateOnScroll"
              value={p.paginateOnScroll}
              onChange={(paginateOnScroll) => patchTypedProps('selectMultiple', { paginateOnScroll })}
              hint={t('field.selectPaginate')}
            />
            <PropNumber
              label="pageSize"
              value={p.pageSize}
              onChange={(pageSize) => patchTypedProps('selectMultiple', { pageSize })}
              placeholder="20"
            />
            <PropText
              label="emptyOptionsText"
              value={p.emptyOptionsText ?? ''}
              onChange={(emptyOptionsText) =>
                patchTypedProps('selectMultiple', { emptyOptionsText })
              }
              placeholder={t('fields.noOptions')}
            />
            <TriState
              label="showSelectedOptions"
              value={p.showSelectedOptions}
              defaultValue
              onChange={(showSelectedOptions) =>
                patchTypedProps('selectMultiple', { showSelectedOptions })
              }
            />
            <TriState
              label="chipsSummary"
              value={p.chipsSummary}
              onChange={(chipsSummary) => patchTypedProps('selectMultiple', { chipsSummary })}
              hint={t('field.multiChips')}
            />
            <TriState
              label="closeOnSelect"
              value={p.closeOnSelect}
              onChange={(closeOnSelect) => patchTypedProps('selectMultiple', { closeOnSelect })}
              hint={t('field.multiCloseOnSelect')}
            />
            <TriState
              label="hideCheckBox"
              value={p.hideCheckBox}
              onChange={(hideCheckBox) => patchTypedProps('selectMultiple', { hideCheckBox })}
              hint={t('field.multiHideCheck')}
            />
          </>
        );
      }
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col stack-gap">
      <Card size="sm" title={t('field.general')} collapsible>
        <div className="flex flex-col stack-gap">
          <div className="flex flex-col stack-gap">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('field.label')}</label>
              <TextField size="sm"
                value={form.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Region Name"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-1">
                <label className="block text-xs font-medium text-foreground">{t('field.name')}</label>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleNameToggle}
                  icon={
                    nameCustom ? (
                      <Link2 className="h-4 w-4" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )
                  }
                  testId="field-name-toggle"
                >
                  {nameCustom ? t('field.autoName') : t('field.customName')}
                </Button>
              </div>
              <TextField size="sm"
                value={form.name}
                onChange={(e) => handleCustomName(e.target.value)}
                onBlur={() => onNameBlur?.()}
                placeholder="regionName"
                disabled={!nameCustom}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('field.type')}</label>
            <SelectField size="sm"
              value={form.type}
              onChange={(next) => handleTypeChange(next as FieldType)}
              options={fieldTypeOptions}
              clearable={false}
              disabled={lockType}
            />
          </div>
        </div>
      </Card>

      {form.type === 'formArrayField' && (
        <Card size="sm" title={t('field.subfields')} collapsible>
          <div className="flex flex-col stack-gap">
            {form.subFields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('field.subEmpty')}
              </p>
            )}
            {form.subFields.map((sub, i) => {
              const typeLabel =
                fieldTypeOptions.find((opt) => opt.value === sub.type)?.label ?? sub.type;
              return (
                <div
                  key={i}
                  data-testid={`subfield-${i}`}
                  role="button"
                  tabIndex={0}
                  title={t('field.clickToEdit')}
                  onClick={() => setSubModal({ mode: 'edit', index: i })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSubModal({ mode: 'edit', index: i });
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 hover:border-primary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {t('field.columnTitle', { index: i + 1, label: sub.label.trim() || t('field.noLabel') })}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {sub.name || t('field.noName')} · {typeLabel} ·{' '}
                      {t(`registry.dataSources.${sub.source}`)}
                      {sub.rules.length > 0 ? ` · ${sub.rules.join('|')}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    title={t('field.deleteColumn')}
                    onClick={(e) => {
                      e.stopPropagation();
                      patch({ subFields: form.subFields.filter((_, j) => j !== i) });
                    }}
                    icon={<Trash2 className="h-4 w-4" />}
                  />
                </div>
              );
            })}
            <div>
              <Button variant="secondary" size="sm" onClick={() => setSubModal({ mode: 'create' })}>
                {t('field.addSub')}
              </Button>
            </div>
            {subModal && (
              <SubFieldModal
                key={subModal.mode === 'edit' ? `edit-${subModal.index}` : 'create'}
                title={
                  subModal.mode === 'edit'
                    ? t('field.editColumn', { label: form.subFields[subModal.index]?.label || t('field.columnTitle', { index: subModal.index + 1, label: t('field.noLabel') }) })
                    : t('field.addColumn')
                }
                initial={
                  subModal.mode === 'edit'
                    ? (form.subFields[subModal.index] ?? blankSubDraft())
                    : blankSubDraft()
                }
                siblingNames={form.subFields
                  .filter((_, j) => subModal.mode === 'create' || j !== subModal.index)
                  .map((s) => s.name)}
                definitions={definitions}
                onClose={() => setSubModal(null)}
                onSave={(next) => {
                  if (subModal.mode === 'create') {
                    patch({ subFields: [...form.subFields, next] });
                  } else {
                    patchSub(subModal.index, next);
                  }
                  setSubModal(null);
                }}
              />
            )}
          </div>
        </Card>
      )}

      <Card size="sm" title={t('field.appearance')} collapsible>
        <div className="flex flex-col stack-gap">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('field.inputLook')}</label>
            <div className="flex flex-col field-gap rounded-lg border border-border px-3 py-2">
              {PLACEHOLDER_TYPES.includes(form.type) && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">{t('field.placeholder')}</label>
                  <TextField size="sm"
                    value={form.placeholder}
                    onChange={(e) => patch({ placeholder: e.target.value })}
                    placeholder={t('field.placeholderAuto')}
                    maxLength={100}
                  />
                </div>
              )}
              {form.type === 'textareaField' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    {t('field.rowsHeight')}
                  </label>
                  <TextField size="sm"
                    value={form.rows}
                    onChange={(e) => patch({ rows: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder={t('field.rowsDefault')}
                    maxLength={2}
                  />
                </div>
              )}
              {form.type === 'fileUploadField' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    {t('field.acceptLabel')}
                  </label>
                  <TextField size="sm"
                    value={form.accept}
                    onChange={(e) => patch({ accept: e.target.value })}
                    placeholder=".pdf,.png"
                    maxLength={100}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">{t('field.disabled')}</label>
                <SelectField size="sm"
                  value={form.disabled ? 'true' : 'false'}
                  onChange={(next) => patch({ disabled: next === 'true' })}
                  options={[
                    { label: t('field.no'), value: 'false' },
                    { label: t('field.yes'), value: 'true' },
                  ]}
                  clearable={false}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('field.disabledDesc')}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('field.componentProps', { comp: componentLabel(t, form.type) })}
            </label>
            <div className="flex flex-col field-gap rounded-lg border border-border px-3 py-2">
              {renderTypedProps()}
            </div>
          </div>
        </div>
      </Card>

      <Card size="sm" title={t('field.advanced', { defaultValue: 'Advanced' })} collapsible>
        <div className="flex flex-col stack-gap">
          {renderAdvancedTypedProps() && (
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {t('field.advancedProps', { defaultValue: 'Advanced props' })}
              </label>
              <div className="flex flex-col field-gap rounded-lg border border-border px-3 py-2">
                {renderAdvancedTypedProps()}
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">{t('field.formItemProps')}</label>
            <div className="flex flex-col field-gap rounded-lg border border-border px-3 py-2">
              <div>
                <label className="mb-1 block font-mono text-xs text-muted-foreground">layout</label>
                <SelectField size="sm"
                  value={form.props.formItem?.layout ?? resolveFormItemLayout(undefined, span)}
                  onChange={(next) => patchFormItem({ layout: next })}
                  options={[
                    { label: 'horizontal', value: 'horizontal' },
                    { label: 'vertical', value: 'vertical' },
                  ]}
                  clearable={false}
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-muted-foreground">align</label>
                <SelectField size="sm"
                  value={form.props.formItem?.align ?? 'start'}
                  onChange={(next) => patchFormItem({ align: next })}
                  options={[
                    { label: 'center', value: 'center' },
                    { label: 'start', value: 'start' },
                  ]}
                  clearable={false}
                />
              </div>
              <PropText
                label={t('field.labelTooltip')}
                value={form.props.formItem?.labelTooltip ?? ''}
                onChange={(labelTooltip) => patchFormItem({ labelTooltip })}
                placeholder={t('field.tooltipPh')}
              />
              <div>
                <label className="mb-1 block font-mono text-xs text-muted-foreground">
                  labelFontWeight
                </label>
                <SelectField size="sm"
                  value={form.props.formItem?.labelFontWeight ?? 'medium'}
                  onChange={(next) => patchFormItem({ labelFontWeight: next })}
                  options={[
                    { label: 'light', value: 'light' },
                    { label: 'normal', value: 'normal' },
                    { label: 'medium', value: 'medium' },
                    { label: 'semibold', value: 'semibold' },
                    { label: 'bold', value: 'bold' },
                  ]}
                  clearable={false}
                />
              </div>
            </div>
          </div>
          {!hideTableFilter && (
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">{t('field.tableFilter')}</label>
              <div className="flex flex-col field-gap">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">{t('field.sortable')}</label>
                  <SelectField size="sm"
                    value={(form.sortable ?? defaultSortable(form.type)) ? 'true' : 'false'}
                    onChange={(next) => patch({ sortable: next === 'true' })}
                    options={[
                      { label: t('field.yes'), value: 'true' },
                      { label: t('field.no'), value: 'false' },
                    ]}
                    clearable={false}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t('field.sortableDesc')}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">{t('field.filterable')}</label>
                  <SelectField size="sm"
                    value={(form.filterable ?? defaultFilterable(form.type)) ? 'true' : 'false'}
                    onChange={(next) => patch({ filterable: next === 'true' })}
                    options={[
                      { label: t('field.yes'), value: 'true' },
                      { label: t('field.no'), value: 'false' },
                    ]}
                    clearable={false}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t('field.filterableDesc')}</p>
                </div>
                {(form.filterable ?? defaultFilterable(form.type)) && (
                  <div className="rounded-lg border border-border px-3 py-2">
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {t('field.filterCriteria')}
                    </label>
                    <SelectField size="sm"
                      value={form.filterCriteria ?? defaultCriteria(form.type)}
                      onChange={(next) => patch({ filterCriteria: next as FilterCriteria })}
                      options={criteriaForFieldType(form.type).map((name) => ({
                        label: t(`registry.filterCriteria.${name}`),
                        value: name,
                      }))}
                      clearable={false}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {
                        t(`registry.filterCriteria.${form.filterCriteria ?? defaultCriteria(form.type)}Desc`)
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>


      <Card size="sm" title={t('field.validation')} collapsible>
        <ValidationEditor rules={form.rules} fieldType={form.type} onChange={(rules) => patch({ rules })} />
      </Card>


      <Card size="sm" title={t('field.sourceData')} collapsible>
        <SourceEditor
          type={form.type}
          source={form.source}
          options={form.options}
          api={form.api}
          relation={form.relation}
          definitions={definitions}
          onPatch={(part) => patch(part)}
        />
      </Card>

    </div>
  );
}

export default FieldForm;
