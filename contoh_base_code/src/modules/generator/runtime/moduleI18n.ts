/**
 * Per-module translations (`module:{key}` namespace, embedded as
 * `ModuleDefinition.i18n`). Lookup falls back to the stored English default,
 * so modules without translations render exactly as before.
 * Murni & Node-safe (reads the global i18next language without touching
 * browser APIs; for live switching call inside render).
 */
import i18n from 'i18next';
import '../../../shared/i18n';
import type { ModuleDefinition } from '../definitions';
import type { GeneratorFieldConfig, ModuleLanguage } from '../types';

export type ModuleTitleKind = 'list' | 'create' | 'edit' | 'detail';

export function fieldLabelKey(name: string): string {
  return `field.${name}.label`;
}

export function fieldPlaceholderKey(name: string): string {
  return `field.${name}.placeholder`;
}

export function moduleTitleKey(kind: ModuleTitleKind): string {
  return `title.${kind}`;
}

export function navLabelKey(): string {
  return 'nav.label';
}

function activeModuleLanguage(): ModuleLanguage {
  try {
    const lng = i18n.language ?? 'en';
    return lng.toLowerCase().startsWith('id') ? 'id' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Resolve a per-module translation key. Fallback chain: active language dict
 * → English dict → provided English default. Tries each candidate key in
 * order (legacy `field.*` schema first, then generator `<base>.fields.*`
 * schema written by the Translation step / Generate-to-repo).
 */
export function moduleText(
  def: Pick<ModuleDefinition, 'i18n'> | undefined,
  key: string,
  fallback: string,
  extraKeys: string[] = [],
): string {
  const dict = def?.i18n;
  if (!dict) return fallback;
  const lng = activeModuleLanguage();
  for (const candidate of [key, ...extraKeys]) {
    const hit = dict[lng]?.[candidate] ?? dict.en?.[candidate];
    if (hit !== undefined) return hit;
  }
  return fallback;
}

type I18nAwareDef = Pick<ModuleDefinition, 'i18n'> & { permissionKey?: string };

/** Generated-schema key for a field label (`<base>.fields.{name}.label`). */
export function generatedFieldLabelKey(def: Pick<ModuleDefinition, 'permissionKey'>, name: string): string {
  return `${def.permissionKey}.fields.${name}.label`;
}

/** Generated-schema key for a field placeholder (`<base>.fields.{name}.placeholder`). */
export function generatedFieldPlaceholderKey(def: Pick<ModuleDefinition, 'permissionKey'>, name: string): string {
  return `${def.permissionKey}.fields.${name}.placeholder`;
}

/** Translated field label, fallback = stored label. */
export function moduleFieldLabel(
  def: I18nAwareDef | undefined,
  field: Pick<GeneratorFieldConfig, 'name' | 'label'>,
): string {
  return moduleText(def, fieldLabelKey(field.name), field.label, [
    `${def?.permissionKey ?? ''}.fields.${field.name}.label`,
  ]);
}

/** Translated placeholder, fallback = stored placeholder. */
export function moduleFieldPlaceholder(
  def: I18nAwareDef | undefined,
  field: Pick<GeneratorFieldConfig, 'name' | 'placeholder'>,
  fallback: string,
): string {
  return moduleText(def, fieldPlaceholderKey(field.name), field.placeholder?.trim() || fallback, [
    `${def?.permissionKey ?? ''}.fields.${field.name}.placeholder`,
  ]);
}

/** Generated-schema title key per kind (`<base>.label` / breadcrumbs). */
function generatedTitleKeys(
  def: { permissionKey?: string } | undefined,
  kind: ModuleTitleKind,
): string[] {
  const base = def?.permissionKey ?? '';
  if (!base) return [];
  switch (kind) {
    case 'list':
      return [`${base}.breadcrumbs.list`, `${base}.labelPlural`];
    case 'create':
      return [`${base}.breadcrumbs.create`];
    case 'edit':
      return [`${base}.breadcrumbs.edit`];
    case 'detail':
      return [`${base}.breadcrumbs.detail`];
  }
}

/** Translated module title, fallback = composed default. */
export function moduleTitle(
  def: I18nAwareDef | undefined,
  kind: ModuleTitleKind,
  fallback: string,
): string {
  return moduleText(def, moduleTitleKey(kind), fallback, generatedTitleKeys(def, kind));
}

export interface ModuleI18nEntry {
  key: string;
  en: string;
  kind: 'label' | 'placeholder' | 'title';
}

/**
 * Collect translatable keys + English source texts for the wizard
 * translations editor. Placeholders fall back to the auto `verb + label`
 * form when the field has no stored placeholder.
 */
export function collectModuleI18nKeys(def: {
  fields: Pick<GeneratorFieldConfig, 'name' | 'label' | 'placeholder'>[];
  singularLabel: string;
}): ModuleI18nEntry[] {
  const entries: ModuleI18nEntry[] = [
    { key: navLabelKey(), en: def.singularLabel, kind: 'title' },
    { key: moduleTitleKey('list'), en: `${def.singularLabel} List`, kind: 'title' },
    { key: moduleTitleKey('create'), en: `Create ${def.singularLabel}`, kind: 'title' },
    { key: moduleTitleKey('edit'), en: `Edit ${def.singularLabel}`, kind: 'title' },
    { key: moduleTitleKey('detail'), en: `${def.singularLabel} Details`, kind: 'title' },
  ];
  for (const field of def.fields) {
    entries.push({ key: fieldLabelKey(field.name), en: field.label, kind: 'label' });
    entries.push({
      key: fieldPlaceholderKey(field.name),
      en: field.placeholder?.trim() || `Enter ${field.label.toLowerCase()}`,
      kind: 'placeholder',
    });
  }
  return entries;
}
