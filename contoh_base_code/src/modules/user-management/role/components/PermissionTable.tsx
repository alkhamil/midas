import { useMemo } from 'react';
import { t } from 'i18next';
import '../../../../shared/i18n';
import { CheckboxField } from '../../../../shared/components/ui';
import { capitalize } from '../../../../shared/utils';

interface PermissionTableProps {
  /** Katalog permission (`modul.aksi`) yang jadi baris × kolom tabel. */
  catalog: string[];
  /** Permission yang dicentang (`modul.aksi`). */
  value: string[];
  onChange?: (next: string[]) => void;
  disabled?: boolean;
  error?: string;
  testId?: string;
}

function splitPermission(permission: string): [string, string] {
  const dot = permission.indexOf('.');
  if (dot < 0) return [permission, ''];
  return [permission.slice(0, dot), permission.slice(dot + 1)];
}

const ACTION_LABELS: Record<string, string> = {
  view: 'role.permissionsTable.view',
  create: 'role.permissionsTable.create',
  update: 'role.permissionsTable.update',
  delete: 'role.permissionsTable.delete',
  bulk_upload: 'role.permissionsTable.bulkUpload',
  export: 'role.permissionsTable.export',
};

/** Urutan kolom aksi: View, Create, Update, Delete, Bulk Upload, Export. */
const ACTION_ORDER = ['view', 'create', 'update', 'delete', 'bulk_upload', 'export'];

function actionLabel(action: string): string {
  const key = ACTION_LABELS[action];
  return key ? t(key) : capitalize(action);
}

function sortActions(actions: string[]): string[] {
  return [...actions].sort((a, b) => {
    const ai = ACTION_ORDER.indexOf(a);
    const bi = ACTION_ORDER.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}

/** Tabel checklist permission: baris = modul, kolom = aksi. */
function PermissionTable({
  catalog,
  value = [],
  onChange,
  disabled,
  error,
  testId = 'role-permissions',
}: PermissionTableProps) {
  const { modules, actions } = useMemo(() => {
    const moduleSet = new Map<string, Set<string>>();
    for (const permission of catalog) {
      const [module, action] = splitPermission(permission);
      if (!moduleSet.has(module)) moduleSet.set(module, new Set());
      if (action) moduleSet.get(module)!.add(action);
    }
    const actionSet = new Set<string>();
    for (const set of moduleSet.values()) for (const action of set) actionSet.add(action);
    return { modules: [...moduleSet.keys()].sort(), actions: sortActions([...actionSet]) };
  }, [catalog]);

  function toggle(permission: string, checked: boolean) {
    if (!onChange || disabled) return;
    onChange(
      checked ? [...value, permission] : value.filter((item) => item !== permission),
    );
  }

  return (
    <div data-testid={testId}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="border-b border-border px-3 py-2 text-left font-medium text-foreground">
                {t('role.permissionsTable.title')}
              </th>
              {actions.map((action) => (
                <th
                  key={action}
                  className="border-b border-border px-3 py-2 text-center font-medium text-foreground"
                >
                  {actionLabel(action)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => (
              <tr key={module} className="bg-background">
                <td className="border-b border-border px-3 py-2 font-medium text-foreground">
                  {capitalize(module)}
                </td>
                {actions.map((action) => {
                  const permission = `${module}.${action}`;
                  if (!catalog.includes(permission)) {
                    return (
                      <td
                        key={action}
                        className="border-b border-border px-3 py-2 text-center text-muted-foreground"
                      >
                        –
                      </td>
                    );
                  }
                  return (
                    <td key={action} className="border-b border-border px-3 py-2 text-center">
                      <CheckboxField
                        testId={`${testId}-${permission}`}
                        value={value.includes(permission)}
                        onChange={(checked) => toggle(permission, checked)}
                        disabled={disabled}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p data-testid={`${testId}-error`} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default PermissionTable;
