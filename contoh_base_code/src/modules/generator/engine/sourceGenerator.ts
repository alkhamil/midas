import { relativeModulePath, resolveRelationTarget, toKebabCase, toPascalCase, toPluralKebab } from '../naming';
import type { FieldModel, TemplateContext } from './context';

/** Endpoint default untuk options: `/api/v1/{plural}/{field}s`, atau override dari config api. */
export function optionsEndpoint(ctx: TemplateContext, field: FieldModel): string {
  if (field.config.source === 'api' && field.config.api?.endpoint) {
    return field.config.api.endpoint;
  }
  return `/api/v1/${ctx.names.pluralKebab}/${toKebabCase(field.name)}s`;
}

function optionsLiteral(field: FieldModel): string {
  const options = field.config.options ?? [];
  if (options.length === 0) return '[]';
  const rows = options.map((o) => `  { label: '${o.label}', value: '${o.value}' },`);
  return `[\n${rows.join('\n')}\n]`;
}

/** Konstanta options mock: `export const mockRoleOptions: RoleOption[] = [...]`. */
export function mockOptionsConst(field: FieldModel): string {
  return `export const ${field.mockOptionsVar}: ${field.optionType}[] = ${optionsLiteral(field)};`;
}

/** Nama helper label sinkron untuk field paging (`getXOptionLabel`). */
export function loadLabelHelper(field: FieldModel): string {
  return `get${field.pascal}OptionLabel`;
}

/**
 * Baris import mock target untuk loader relasi. Target wajib sudah
 * publish-ke-repo sebelumnya (import statis). Path dihitung relatif dari
 * direktori modul konsumen (`consumerDir`, mis. `ctx.names.dir`) agar benar
 * untuk modul ber-parent (nested).
 */
export function mockRelationOptionsImport(field: FieldModel, consumerDir?: string): string {
  const target = resolveRelationTarget(field.config.relation);
  const fallbackSegs = toKebabCase(field.name);
  const targetDir = target?.targetDir ?? `src/modules/${fallbackSegs}`;
  const importPath = consumerDir
    ? relativeModulePath(`${consumerDir.replace(/\/$/, '')}/api/mock.ts`, `${targetDir}/api/mock`)
    : (target?.mockImportPath ?? `../../${fallbackSegs}/api/mock`);
  const mockFn = target?.mockListFn ?? `mockGet${toPascalCase(toPluralKebab(fallbackSegs))}`;
  return `import { ${mockFn} } from '${importPath}';`;
}

/**
 * Loader mock untuk field relasi: options dari records modul target.
 */
export function mockRelationOptionsFn(field: FieldModel): string {
  const target = resolveRelationTarget(field.config.relation);
  const labelField = field.config.relation?.labelField || 'name';
  const valueField = field.config.relation?.valueField?.trim() || 'id';
  const mockFn = target?.mockListFn ?? `mockGet${toPascalCase(toPluralKebab(toKebabCase(field.name)))}`;
  return `export async function ${field.loadOptionsFn}(
  search = '',
  page = 1,
  size = 20,
): Promise<${field.optionType}[]> {
  const res = await ${mockFn}({ search: search || undefined, page: page - 1, size });
  return res.list.content.map((r) => {
    const record = r as unknown as Record<string, unknown>;
    return {
      label: String(record['${labelField}'] ?? ''),
      value: String(record['${valueField}'] ?? ''),
    };
  });
}`;
}

/** Base list + fungsi load mock paginated/searchable untuk SelectField `loadOptions`. */
export function mockLoadOptionsFn(field: FieldModel): string {
  const baseItems =
    field.config.options && field.config.options.length > 0
      ? field.config.options
          .map((o) => `  { label: '${o.label}', value: '${o.value}' },`)
          .join('\n')
      : Array.from(
          { length: 60 },
          (_, i) => `  { label: '${field.label} ${i + 1}', value: '${field.name.toUpperCase()}_${i + 1}' },`,
        ).join('\n');
  return `const ${field.mockOptionsVar}Base: ${field.optionType}[] = [\n${baseItems}\n];

export async function ${field.loadOptionsFn}(
  search = '',
  page = 1,
  size = 20,
): Promise<${field.optionType}[]> {
  await delay(300);
  const q = search.toLowerCase();
  const filtered = q
    ? ${field.mockOptionsVar}Base.filter((o) => o.label.toLowerCase().includes(q))
    : ${field.mockOptionsVar}Base;
  return filtered.slice((page - 1) * size, page * size);
}

/** Label sinkron dari value untuk kolom tabel/detail; tak ketemu → value as-is. */
export function ${loadLabelHelper(field)}(value: string): string {
  return ${field.mockOptionsVar}Base.find((o) => o.value === value)?.label ?? value;
}`;
}

/** Nilai mock satu record untuk field ini (index-based, deterministik). */
export function mockRecordValue(field: FieldModel, indexVar = 'i'): string {
  // Relasi: id kecil berpeluang cocok records target sehingga label tampil di tabel.
  if (field.config.source === 'relation') return `String((${indexVar} % 5) + 1)`;
  const options = field.config.options ?? [];
  const optionValues = options.map((o) => `'${o.value}'`).join(', ');
  switch (field.config.type) {
    case 'numberField':
    case 'currencyField':
      return `100000 * (${indexVar} + 1)`;
    case 'dateField':
      return `\`2024-0\${(${indexVar} % 9) + 1}-\${10 + (${indexVar} % 9)}\``;
    case 'dateRangeField':
      return `\`2024-0\${(${indexVar} % 9) + 1}-10,2024-0\${(${indexVar} % 9) + 1}-15\``;
    case 'checkboxField':
    case 'switchField':
      return `${indexVar} % 2 === 0`;
    case 'passwordField':
      return `\`P@ssw0rd-\${${indexVar} + 1}\``;
    case 'fileUploadField':
      return `\`document-\${${indexVar} + 1}.pdf\``;
    case 'colorField':
      return `['#EF4444','#22C55E','#3B82F6','#F59E0B','#8B5CF6'][${indexVar} % 5]`;
    case 'editorField':
      return `\`<p>${field.label} ${'${' + indexVar + ' + 1}'} description</p>\``;
    case 'formArrayField': {
      const subs = (field.config.subFields ?? []).filter((sub) => sub.type !== 'formArrayField');
      if (subs.length === 0) return '[]';
      const rows = [0, 1].map((rowIndex) => {
        const cells = subs
          .map((sub) => {
            const subModel = {
              ...field,
              config: sub,
              name: sub.name,
              label: sub.label,
            } as FieldModel;
            return `${sub.name}: ${mockRecordValue(subModel, `(${indexVar} + ${rowIndex})`)}`;
          })
          .join(', ');
        return `{ ${cells} }`;
      });
      return `[${rows.join(', ')}]`;
    }
    case 'selectMultipleField':
    case 'checkboxGroupField': {
      if (options.length > 0) {
        return `[${optionValues}].slice(${indexVar} % ${options.length}, (${indexVar} % ${options.length}) + 2)`;
      }
      return `[\`${field.name.toUpperCase()}_\${(${indexVar} % 5) + 1}\`, \`${field.name.toUpperCase()}_\${((${indexVar} + 1) % 5) + 1}\`]`;
    }
    case 'selectField':
    case 'radioGroupField': {
      if (options.length > 0) {
        return `[${optionValues}][${indexVar} % ${options.length}]`;
      }
      return `\`${field.name.toUpperCase()}_\${${indexVar} + 1}\``;
    }
    case 'textareaField':
      return `\`${field.label} ${'${' + indexVar + ' + 1}'} text\``;
    case 'textField':
    default:
      return `\`${field.label} ${'${' + indexVar + ' + 1}'}\``;
  }
}

/** Baris filter mock sesuai kriteria field. */
export function mockFilterLine(field: FieldModel): string {
  const name = field.name;
  switch (field.filterCriteria) {
    case 'contains':
      return `if (params?.${name}) {
    const q${field.pascal} = params.${name}.toLowerCase();
    items = items.filter((r) => String(r.${name} ?? '').toLowerCase().includes(q${field.pascal}));
  }`;
    case 'exact':
      return `if (params?.${name}) items = items.filter((r) => String(r.${name} ?? '') === params.${name});`;
    case 'numberExact':
      return `if (params?.${name} !== undefined && params.${name} !== '') items = items.filter((r) => Number(r.${name}) === Number(params.${name}));`;
    case 'numberMin':
      return `if (params?.${name} !== undefined && params.${name} !== '') items = items.filter((r) => Number(r.${name}) >= Number(params.${name}));`;
    case 'numberMax':
      return `if (params?.${name} !== undefined && params.${name} !== '') items = items.filter((r) => Number(r.${name}) <= Number(params.${name}));`;
    case 'numberRange':
      return `if (params?.${name}Min !== undefined && params.${name}Min !== '') items = items.filter((r) => Number(r.${name}) >= Number(params.${name}Min));
  if (params?.${name}Max !== undefined && params.${name}Max !== '') items = items.filter((r) => Number(r.${name}) <= Number(params.${name}Max));`;
    case 'dateExact':
      return `if (params?.${name}) items = items.filter((r) => r.${name} === params.${name});`;
    case 'dateRange': {
      return `if (params?.${name}) {
    const [start${field.pascal}, end${field.pascal}] = params.${name}.split(',');
    if (start${field.pascal} && end${field.pascal}) items = items.filter((r) => r.${name} >= start${field.pascal} && r.${name} <= end${field.pascal});
  }`;
    }
    case 'dateOverlap': {
      return `if (params?.${name}) {
    const [from${field.pascal}, to${field.pascal}] = params.${name}.split(',');
    if (from${field.pascal} && to${field.pascal}) items = items.filter((r) => {
      const [recordStart, recordEnd] = String(r.${name} ?? '').split(',');
      return recordStart <= to${field.pascal} && from${field.pascal} <= recordEnd;
    });
  }`;
    }
    case 'optionAny': {
      return `if (params?.${name}) {
    const selected${field.pascal} = new Set(params.${name}.split(','));
    items = items.filter((r) => (r.${name} as string[]).some((v) => selected${field.pascal}.has(v)));
  }`;
    }
    case 'booleanExact':
      return `if (params?.${name}) items = items.filter((r) => String(r.${name}) === params.${name});`;
    case 'optionExact':
    default:
      return `if (params?.${field.name}) items = items.filter((r) => r.${field.name} === params.${field.name});`;
  }
}

/** Mapping record API → option bila valueField/labelField custom (source api). */
export function optionMapping(field: FieldModel): string | null {
  const api = field.config.api;
  if (field.config.source !== 'api' || !api) return null;
  const valueField = api.valueField && api.valueField !== 'value' ? api.valueField : null;
  const labelField = api.labelField && api.labelField !== 'label' ? api.labelField : null;
  if (!valueField && !labelField) return null;
  const valueExpr = valueField ? `String(item.${valueField})` : 'item.value';
  const labelExpr = labelField ? `String(item.${labelField})` : 'item.label';
  return `(item: Record<string, unknown>) => ({ label: ${labelExpr}, value: ${valueExpr} })`;
}
