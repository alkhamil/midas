import type { ModuleInfoValue } from '../components/ModuleInfoStep';
import type { FeatureKey, GeneratorFieldConfig, MenuIcon } from '../types';
import type { DeleteMode, ModuleLayout } from '../definitions';
import { NEW_PARENT_VALUE } from '../definitions/parents';
import type { ModuleDefinition } from '../definitions/types';
import { resolveNames, toKebabCase } from '../naming';
import type { ModuleI18nDict } from '../types';
import type { DynamicDetail, DynamicListItem } from '../runtime/types';
import { payloadValue, type DynamicFormValues } from '../runtime/validation';

const DRAFT_KEY = 'builder_draft_v1';

/** State wizard yang dipersist ke localStorage agar tahan refresh. */
export interface BuilderDraft {
  info: ModuleInfoValue;
  features: Record<FeatureKey, boolean>;
  fields: GeneratorFieldConfig[];
  layout: ModuleLayout | null;
  deleteMode: DeleteMode;
  menuIcon: MenuIcon | null;
  i18n?: ModuleI18nDict;
  sampleRows: DynamicListItem[];
  step: number;
  updatedAt: string;
}

function toMenuIcon(raw: unknown): MenuIcon | null {
  if (!raw || typeof raw !== 'object') return null;
  const { name } = raw as Record<string, unknown>;
  if (typeof name !== 'string' || name.trim() === '') return null;
  return { name: name.trim() };
}

export function saveDraft(draft: Omit<BuilderDraft, 'updatedAt'>): void {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Abaikan: mode privat / kuota penuh.
  }
}

export function loadDraft(): BuilderDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuilderDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.info || !parsed.features || !Array.isArray(parsed.fields)) return null;
    return {
      info: parsed.info,
      features: parsed.features,
      fields: parsed.fields,
      layout: parsed.layout ?? null,
      deleteMode: parsed.deleteMode === 'hard' ? 'hard' : 'soft',
      menuIcon: toMenuIcon(parsed.menuIcon),
      i18n: parsed.i18n,
      sampleRows: Array.isArray(parsed.sampleRows) ? parsed.sampleRows : [],
      step: typeof parsed.step === 'number' ? parsed.step : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Abaikan.
  }
}

/**
 * Kunci definisi yang akan dihasilkan dari info draft (cermin
 * `configToDefinition`: parent di-kebab per segmen + nama modul).
 */
export function draftDefinitionKey(info: ModuleInfoValue): string {
  const rawParent =
    info.parentName === NEW_PARENT_VALUE ? info.newParentName.trim() : info.parentName;
  const parentName = rawParent.trim() !== '' ? rawParent.trim() : null;
  const names = resolveNames(parentName, info.moduleName.trim());
  const parent = parentName
    ? parentName
        .split('/')
        .map((part) => toKebabCase(part))
        .filter(Boolean)
        .join('/')
    : null;
  return parent ? `${parent}/${names.kebab}` : names.kebab;
}

/**
 * True bila draft tersimpan milik modul ber-key ini — dipakai membersihkan
 * draft saat modulnya dihapus dari daftar (draft modul lain dibiarkan).
 */
export function isDraftOfModule(
  draft: BuilderDraft | null,
  def: Pick<ModuleDefinition, 'key'>,
): boolean {
  if (!draft || draft.info.moduleName.trim() === '') return false;
  try {
    return draftDefinitionKey(draft.info) === def.key;
  } catch {
    return false;
  }
}

function nowStamp(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Nilai form → baris contoh untuk pratinjau list/detail.
 * Samakan dengan payload record (`payloadValue`): File → nama file agar
 * aman di-render dan aman diserialisasi ke draft localStorage.
 */
export function valuesToSampleRow(
  values: DynamicFormValues,
  id: number,
  fields: GeneratorFieldConfig[] = [],
): DynamicListItem {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const data: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    const field = byName.get(name);
    data[name] = field ? payloadValue(field, value) : value instanceof File ? value.name : value;
  }
  return {
    id,
    status: 'active',
    created_by: 'Test Data',
    created_date: nowStamp(),
    ...data,
  };
}

/** Baris contoh → bentuk detail untuk pratinjau DetailCard. */
export function sampleToDetail(row: DynamicListItem): DynamicDetail {
  const { id, status, created_by, created_date, ...data } = row;
  return {
    id: String(id),
    status,
    createdBy: created_by ?? '',
    createdDate: created_date,
    ...data,
  };
}
