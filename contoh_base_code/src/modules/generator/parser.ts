import { t } from 'i18next';
import '../../shared/i18n';
import type { GeneratorConfig, GeneratorFieldConfig } from './types';
import { MENU_ICON_NAME_RE } from './types';
import { pruneComponentProps } from './componentProps';
import { toCamelCase, toPascalCase } from './naming';
import {
  criteriaForFieldType,
  dataSourceRegistry,
  defaultCriteria,
  defaultFilterable,
  defaultSortable,
  validationRegistry,
} from './registry';

/**
 * Nama field yang dipakai kolom sistem record (`id` numerik otomatis +
 * `status`/`created_by`/`created_date`) — tidak boleh dipakai field bisnis.
 */
export const RESERVED_FIELD_NAMES: readonly string[] = [
  'id',
  'status',
  'created_by',
  'created_date',
];

export function isReservedFieldName(name: string): boolean {
  return RESERVED_FIELD_NAMES.includes(name.toLowerCase());
}

/** Rule berargumen numerik (`min`/`max`/`minLength`/`maxLength`). */
const NUMERIC_RULES: readonly string[] = ['min', 'max', 'minLength', 'maxLength'];

/**
 * Validasi argumen rules satu field/sub (`min:` kosong, angka tak valid,
 * pola regex rusak). Dipakai field parent maupun sub-field array.
 */
function checkFieldRules(
  rules: string[],
  basePath: string,
  ownerName: string,
  issues: ConfigIssue[],
): void {
  for (const rawRule of rules) {
    const { name: ruleName, arg: ruleArg } = splitRule(rawRule.trim());
    const ruleDef = validationRegistry[ruleName as keyof typeof validationRegistry];
    if (!ruleDef?.needsArg) continue;
    const rulePath = `${basePath}.rules`;
    const value = (ruleArg ?? '').trim();
    if (value === '') {
      issues.push({
        path: rulePath,
        message: t('configValidate.fieldRuleArg', { name: ownerName, rule: ruleName }),
      });
    } else if (NUMERIC_RULES.includes(ruleName) && !Number.isFinite(Number(value))) {
      issues.push({
        path: rulePath,
        message: t('configValidate.fieldRuleNumeric', { name: ownerName, rule: ruleName }),
      });
    } else if (ruleName === 'regex') {
      try {
        new RegExp(value);
      } catch {
        issues.push({
          path: rulePath,
          message: t('configValidate.fieldRuleRegex', { name: ownerName }),
        });
      }
    }
  }
}

/** `required|min:3|max:100` → `["required", "min:3", "max:100"]`. */
export function parseRulesString(rules: string): string[] {
  return rules
    .split('|')
    .map((rule) => rule.trim())
    .filter(Boolean);
}

/** `["required", "min:3"]` → `required|min:3`. */
export function stringifyRules(rules: string[]): string {
  return rules.join('|');
}

/** Pecah satu rule menjadi nama + argumen: `min:3` → `{ name: 'min', arg: '3' }`. */
export function splitRule(rule: string): { name: string; arg?: string } {
  const index = rule.indexOf(':');
  if (index === -1) return { name: rule };
  return { name: rule.slice(0, index), arg: rule.slice(index + 1) };
}

/** Normalisasi nama field dari label: `Region Name` → `{ name: 'regionName', label: 'Region Name' }`. */
export function deriveFieldNaming(label: string): { name: string; label: string } {
  return { name: toCamelCase(label), label: label.trim() };
}

/**
 * Nama field unik dari basis (hindari duplikat + reserved kolom sistem).
 * `text` (dipakai) → `text2`; `id` (reserved) → `id2`.
 */
export function uniqueFieldName(base: string, existingNames: string[]): string {
  const clean = base.trim() || 'field';
  if (!isReservedFieldName(clean) && !existingNames.includes(clean)) return clean;
  let counter = 2;
  while (isReservedFieldName(`${clean}${counter}`) || existingNames.includes(`${clean}${counter}`)) {
    counter += 1;
  }
  return `${clean}${counter}`;
}

/** Normalisasi nama modul untuk validasi: harus menghasilkan PascalCase valid. */
export function normalizeModuleName(input: string): string {
  return toPascalCase(input);
}

export interface ConfigIssue {
  path: string;
  message: string;
}

/** Validasi konfigurasi sebelum generate. Return daftar masalah (kosong = valid). */
export function validateConfig(config: GeneratorConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (!config.moduleName || !normalizeModuleName(config.moduleName)) {
    issues.push({ path: 'moduleName', message: t('configValidate.moduleNameRequired') });
  }
  if (config.parentName && config.parentName.length > 50) {
    issues.push({ path: 'parentName', message: t('configValidate.parentMax') });
  }
  if (config.parentName && !/^[a-zA-Z0-9 /_-]*$/.test(config.parentName)) {
    issues.push({ path: 'parentName', message: t('configValidate.parentInvalid') });
  }
  if (!config.permissionKey || config.permissionKey.trim() === '') {
    issues.push({ path: 'permissionKey', message: t('configValidate.permissionRequired') });
  } else if (config.permissionKey.length > 100) {
    issues.push({ path: 'permissionKey', message: t('configValidate.permissionMax') });
  } else if (!/^[a-z][a-z0-9_]*$/.test(config.permissionKey)) {
    issues.push({
      path: 'permissionKey',
      message: t('configValidate.permissionPattern'),
    });
  }
  if (!Object.values(config.features).some(Boolean)) {
    issues.push({ path: 'features', message: t('configValidate.featureRequired') });
  }
  if ((config.features.bulkUpload || config.features.export) && !config.features.list) {
    issues.push({
      path: 'features',
      message: t('configValidate.bulkNeedsList'),
    });
  }
  if (config.fields.length === 0) {
    issues.push({ path: 'fields', message: t('configValidate.fieldRequired') });
  }
  if (
    config.features.bulkUpload &&
    !config.fields.some((field) => field.type !== 'fileUploadField' && field.type !== 'formArrayField')
  ) {
    issues.push({
      path: 'features',
      message: t('configValidate.bulkNeedsField'),
    });
  }

  const seen = new Set<string>();
  config.fields.forEach((field, index) => {
    const path = `fields[${index}]`;
    if (!field.name) {
      issues.push({ path: `${path}.name`, message: t('configValidate.fieldNameRequired') });
    } else if (seen.has(field.name)) {
      issues.push({ path: `${path}.name`, message: t('configValidate.fieldNameDup', { name: field.name }) });
    } else if (isReservedFieldName(field.name)) {
      issues.push({
        path: `${path}.name`,
        message: t('configValidate.fieldNameReserved', { name: field.name }),
      });
    } else {
      seen.add(field.name);
    }
    if (!field.label) {
      issues.push({ path: `${path}.label`, message: t('configValidate.fieldLabelRequired') });
    }
    checkFieldRules(field.rules, path, field.name, issues);
    const allowedSources = (
      Object.keys(dataSourceRegistry) as (keyof typeof dataSourceRegistry)[]
    ).filter((source) => dataSourceRegistry[source].appliesTo.includes(field.type));
    if (!allowedSources.includes(field.source)) {
      issues.push({
        path: `${path}.source`,
        message: t('configValidate.fieldSource', { name: field.name, type: field.type, sources: allowedSources.join(', ') }),
      });
    }
    if (field.source === 'mockStatic') {
      if (!field.options || field.options.length === 0) {
        issues.push({
          path: `${path}.options`,
          message: t('configValidate.fieldOptions', { name: field.name }),
        });
      }
    }
    if (field.source === 'api') {
      if (!field.api?.endpoint) {
        issues.push({
          path: `${path}.api.endpoint`,
          message: t('configValidate.fieldApi', { name: field.name }),
        });
      }
    }
    if (field.source === 'relation') {
      if (!field.relation?.definitionKey) {
        issues.push({
          path: `${path}.relation.definitionKey`,
          message: t('configValidate.fieldRelationTarget', { name: field.name }),
        });
      }
      if (!field.relation?.labelField) {
        issues.push({
          path: `${path}.relation.labelField`,
          message: t('configValidate.fieldRelationLabel', { name: field.name }),
        });
      }
    }
    const criteria = field.filterCriteria ?? defaultCriteria(field.type);
    const filterable = field.filterable ?? defaultFilterable(field.type);
    if (filterable && !criteriaForFieldType(field.type).includes(criteria)) {
      issues.push({
        path: `${path}.filterCriteria`,
        message: t('configValidate.fieldCriteria', { name: field.name, type: field.type, criteria }),
      });
    }
    if (field.type === 'formArrayField') {
      const subs = field.subFields ?? [];
      if (subs.length === 0) {
        issues.push({
          path: `${path}.subFields`,
          message: t('configValidate.fieldSubs', { name: field.name }),
        });
      }
      const seenSub = new Set<string>();
      subs.forEach((sub, subIndex) => {
        const subPath = `${path}.subFields[${subIndex}]`;
        if (!sub.name) {
          issues.push({ path: `${subPath}.name`, message: t('configValidate.subNameRequired') });
        } else if (seenSub.has(sub.name)) {
          issues.push({
            path: `${subPath}.name`,
            message: t('configValidate.subNameDup', { name: sub.name }),
          });
        } else if (isReservedFieldName(sub.name)) {
          issues.push({
            path: `${subPath}.name`,
            message: t('configValidate.subNameReserved', { name: sub.name }),
          });
        } else {
          seenSub.add(sub.name);
        }
        if (!sub.label?.trim()) {
          issues.push({ path: `${subPath}.label`, message: t('configValidate.subLabelRequired') });
        }
        checkFieldRules(sub.rules, subPath, sub.name, issues);
        if (sub.type === 'formArrayField') {
          issues.push({
            path: `${subPath}.type`,
            message: t('configValidate.subNoNested'),
          });
        }
        const allowedSubSources = (
          Object.keys(dataSourceRegistry) as (keyof typeof dataSourceRegistry)[]
        ).filter((source) => dataSourceRegistry[source].appliesTo.includes(sub.type));
        if (!allowedSubSources.includes(sub.source)) {
          issues.push({
            path: `${subPath}.source`,
            message: t('configValidate.subSource', { name: sub.name, type: sub.type, sources: allowedSubSources.join(', ') }),
          });
        }
        if (
          sub.source === 'mockStatic' &&
          (!sub.options || sub.options.length === 0) &&
          ['selectField', 'selectMultipleField', 'radioGroupField', 'checkboxGroupField'].includes(
            sub.type,
          )
        ) {
          issues.push({
            path: `${subPath}.options`,
            message: t('configValidate.subOptions', { name: sub.name }),
          });
        }
        if (sub.source === 'api' && !sub.api?.endpoint) {
          issues.push({
            path: `${subPath}.api.endpoint`,
            message: t('configValidate.subApi', { name: sub.name }),
          });
        }
        if (sub.source === 'relation') {
          if (!sub.relation?.definitionKey) {
            issues.push({
              path: `${subPath}.relation.definitionKey`,
              message: t('configValidate.subRelationTarget', { name: sub.name }),
            });
          }
          if (!sub.relation?.labelField) {
            issues.push({
              path: `${subPath}.relation.labelField`,
              message: t('configValidate.subRelationLabel', { name: sub.name }),
            });
          }
        }
      });
    }
  });

  // Ikon menu: nama komponen lucide-react (keberadaan ikon dicek saat render/register).
  if (config.menuIcon) {
    if (!MENU_ICON_NAME_RE.test(config.menuIcon.name.trim())) {
      issues.push({ path: 'menuIcon.name', message: t('configValidate.iconNameRequired') });
    }
  }

  return issues;
}

/** Normalisasi satu sub-field array: satu level, source penuh per tipe (paritas parent). */
function normalizeSubField(sub: GeneratorFieldConfig): GeneratorFieldConfig {
  const allowedSources = (Object.keys(dataSourceRegistry) as (keyof typeof dataSourceRegistry)[]).filter(
    (source) => dataSourceRegistry[source].appliesTo.includes(sub.type),
  );
  const source = allowedSources.includes(sub.source) ? sub.source : 'none';
  const keepOptions = source === 'mockStatic' || source === 'api';
  return {
    ...sub,
    name: toCamelCase(sub.name),
    label: sub.label.trim(),
    rules: sub.rules.map((rule) => rule.trim()).filter(Boolean),
    source,
    options: keepOptions ? sub.options : undefined,
    api: source === 'api' ? sub.api : undefined,
    relation: source === 'relation' ? sub.relation : undefined,
    placeholder: sub.placeholder?.trim() ? sub.placeholder.trim() : undefined,
    disabled: sub.disabled === true ? true : undefined,
    rows:
      sub.type === 'textareaField' && sub.rows && sub.rows > 0
        ? Math.min(20, Math.floor(sub.rows))
        : undefined,
    accept: sub.type === 'fileUploadField' && sub.accept?.trim() ? sub.accept.trim() : undefined,
    subFields: undefined,
    componentProps: pruneComponentProps(sub.type, sub.componentProps),
  };
}

/** Normalisasi ringan sebelum generate (trim label/nama, buang rules kosong, default tabel/filter). */
export function normalizeConfig(config: GeneratorConfig): GeneratorConfig {
  const fields: GeneratorFieldConfig[] = config.fields.map((field) => ({
    ...field,
    name: toCamelCase(field.name),
    label: field.label.trim(),
    rules: field.rules.map((rule) => rule.trim()).filter(Boolean),
    sortable: field.sortable ?? defaultSortable(field.type),
    filterable: field.filterable ?? defaultFilterable(field.type),
    filterCriteria: field.filterable === false ? null : (field.filterCriteria ?? defaultCriteria(field.type)),
    // Buang muatan source yang tak relevan agar draft panel tetap bersih.
    options: field.source === 'mockStatic' || field.source === 'api' ? field.options : undefined,
    api: field.source === 'api' ? field.api : undefined,
    relation: field.source === 'relation' ? field.relation : undefined,
    placeholder: field.placeholder?.trim() ? field.placeholder.trim() : undefined,
    disabled: field.disabled === true ? true : undefined,
    rows:
      field.type === 'textareaField' && field.rows && field.rows > 0
        ? Math.min(20, Math.floor(field.rows))
        : undefined,
    accept:
      field.type === 'fileUploadField' && field.accept?.trim() ? field.accept.trim() : undefined,
    subFields:
      field.type === 'formArrayField'
        ? (field.subFields ?? [])
            .filter((sub) => sub.type !== 'formArrayField')
            .map(normalizeSubField)
        : undefined,
    componentProps: pruneComponentProps(field.type, field.componentProps),
  }));
  return {
    ...config,
    parentName:
      config.parentName && config.parentName.trim() !== '' ? config.parentName.trim() : null,
    moduleName: config.moduleName.trim(),
    permissionKey: config.permissionKey.trim().toLowerCase(),
    fields,
  };
}
