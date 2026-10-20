import { t } from 'i18next';
import '../../../shared/i18n';
import type { GeneratorConfig } from '../types';
import { validateConfig, type ConfigIssue } from '../parser';
import type { ModuleDefinition } from './types';
import { MODULE_DEFINITION_VERSION, SYSTEM_TABLE_COLUMNS } from './types';

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const ROUTE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/**
 * Validasi definisi modul. Memakai ulang `validateConfig` untuk bagian
 * config (permission key, features, fields) + aturan layout v1.
 * Return daftar masalah (kosong = valid). Murni & Node-safe.
 */
export function validateDefinition(def: ModuleDefinition): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (def.version !== MODULE_DEFINITION_VERSION) {
    issues.push({
      path: 'version',
      message: t('configValidate.defVersion', { version: MODULE_DEFINITION_VERSION }),
    });
  }
  if (!def.key || !KEY_PATTERN.test(def.key)) {
    issues.push({
      path: 'key',
      message: t('configValidate.defKey'),
    });
  }
  if (!def.label || !def.label.trim()) {
    issues.push({ path: 'label', message: t('configValidate.defLabel') });
  }
  if (!def.singularLabel || !def.singularLabel.trim()) {
    issues.push({ path: 'singularLabel', message: t('configValidate.defSingular') });
  }
  if (!def.routeBase || !ROUTE_PATTERN.test(def.routeBase.replace(/^\/+|\/+$/g, ''))) {
    issues.push({ path: 'routeBase', message: t('configValidate.defRoute') });
  }
  if (!def.apiPlural || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(def.apiPlural)) {
    issues.push({ path: 'apiPlural', message: t('configValidate.defApiPlural') });
  }
  if (def.deleteMode !== 'hard' && def.deleteMode !== 'soft') {
    issues.push({ path: 'deleteMode', message: t('configValidate.defDeleteMode') });
  }
  if (def.status !== 'draft' && def.status !== 'published') {
    issues.push({ path: 'status', message: t('configValidate.defStatus') });
  }
  if (def.i18n !== undefined) {
    const langs = Object.entries(def.i18n);
    const bad =
      !Array.isArray(langs) ||
      langs.some(
        ([lng, dict]) =>
          (lng !== 'en' && lng !== 'id') ||
          !dict ||
          typeof dict !== 'object' ||
          Object.entries(dict).some(
            ([key, value]) => typeof key !== 'string' || typeof value !== 'string',
          ),
      );
    if (bad) issues.push({ path: 'i18n', message: t('configValidate.defI18n') });
  }

  const asConfig: GeneratorConfig = {
    parentName: def.parent,
    moduleName: def.key,
    type: def.moduleType,
    permissionKey: def.permissionKey,
    features: { ...def.features },
    fields: def.fields,
    menuIcon: def.menuIcon,
  };
  issues.push(...validateConfig(asConfig));

  const known = new Set(def.fields.map((field) => field.name));
  const seenForm = new Set<string>();
  def.layout.form.forEach((item, index) => {
    const path = `layout.form[${index}]`;
    const kind = item.kind ?? 'field';
    if (kind !== 'field' && kind !== 'section' && kind !== 'divider') {
      issues.push({ path: `${path}.kind`, message: t('configValidate.layoutKind') });
    } else if (kind === 'field' && !known.has(item.field)) {
      issues.push({ path: `${path}.field`, message: t('configValidate.layoutUnknownField', { name: item.field }) });
    } else if (kind !== 'field' && known.has(item.field)) {
      issues.push({
        path: `${path}.field`,
        message: t('configValidate.layoutIdConflict', { name: item.field }),
      });
    } else if (seenForm.has(item.field)) {
      issues.push({ path: `${path}.field`, message: t('configValidate.layoutDup', { name: item.field }) });
    } else {
      seenForm.add(item.field);
    }
    if (!Number.isInteger(item.order) || item.order < 0) {
      issues.push({ path: `${path}.order`, message: t('configValidate.layoutOrder') });
    }
    if (!Number.isInteger(item.colSpan) || item.colSpan < 1 || item.colSpan > 12) {
      issues.push({ path: `${path}.colSpan`, message: t('configValidate.layoutColSpan') });
    }
  });
  for (const name of known) {
    if (!seenForm.has(name)) {
      issues.push({ path: 'layout.form', message: t('configValidate.layoutMissingForm', { name }) });
    }
  }
  const seenOrder = new Set<string>();
  def.layout.table.order.forEach((name, index) => {
    if (!known.has(name) && !SYSTEM_TABLE_COLUMNS.includes(name)) {
      issues.push({
        path: `layout.table.order[${index}]`,
        message: t('configValidate.layoutUnknownField', { name }),
      });
    } else if (seenOrder.has(name)) {
      issues.push({
        path: `layout.table.order[${index}]`,
        message: t('configValidate.layoutDupTable', { name }),
      });
    } else {
      seenOrder.add(name);
    }
  });
  for (const name of known) {
    if (!seenOrder.has(name)) {
      issues.push({ path: 'layout.table.order', message: t('configValidate.layoutMissingTable', { name }) });
    }
  }
  for (const name of def.layout.table.hidden) {
    if (!seenOrder.has(name)) {
      issues.push({
        path: 'layout.table.hidden',
        message: t('configValidate.layoutHiddenInOrder', { name }),
      });
    }
  }
  for (const [name, width] of Object.entries(def.layout.table.widths ?? {})) {
    if (!seenOrder.has(name)) {
      issues.push({
        path: `layout.table.widths.${name}`,
        message: t('configValidate.layoutMissingTable', { name }),
      });
    } else if (!Number.isInteger(width) || width < 40 || width > 1200) {
      issues.push({
        path: `layout.table.widths.${name}`,
        message: t('configValidate.layoutWidthRange'),
      });
    }
  }
  if (def.layout.detail !== undefined) {
    const seenDetail = new Set<string>();
    def.layout.detail.order.forEach((name, index) => {
      if (!known.has(name) && !SYSTEM_TABLE_COLUMNS.includes(name)) {
        issues.push({
          path: `layout.detail.order[${index}]`,
          message: t('configValidate.layoutUnknownField', { name }),
        });
      } else if (seenDetail.has(name)) {
        issues.push({
          path: `layout.detail.order[${index}]`,
          message: t('configValidate.layoutDupDetail', { name }),
        });
      } else {
        seenDetail.add(name);
      }
    });
    for (const name of known) {
      if (!seenDetail.has(name)) {
        issues.push({
          path: 'layout.detail.order',
          message: t('configValidate.layoutMissingDetail', { name }),
        });
      }
    }
    for (const name of def.layout.detail.hidden) {
      if (!seenDetail.has(name)) {
        issues.push({
          path: 'layout.detail.hidden',
          message: t('configValidate.layoutHiddenInOrder', { name }),
        });
      }
    }
  }

  return issues;
}
