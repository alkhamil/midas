import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SelectField, TextField } from '../../../shared/components/ui';
import ModuleMenuIcon from './ModuleMenuIcon';
import type { MenuIcon, ModuleType } from '../types';
import { moduleTypeOptions } from '../registry';
import { NEW_PARENT_VALUE } from '../definitions/parents';
import { toPermissionKey } from '../naming';

export interface ModuleInfoValue {
  /** '' = root, nama parent yang ada, atau NEW_PARENT_VALUE. */
  parentName: string;
  /** Nama parent baru bila parentName === NEW_PARENT_VALUE. */
  newParentName: string;
  moduleName: string;
  type: ModuleType;
  permissionKey: string;
}

/** Parent efektif untuk config: teks baru bila mode "Parent baru". */
export function resolveEffectiveParent(value: ModuleInfoValue): string {
  if (value.parentName === NEW_PARENT_VALUE) return value.newParentName.trim();
  return value.parentName;
}

interface ModuleInfoStepProps {
  value: ModuleInfoValue;
  onChange: (value: ModuleInfoValue) => void;
  errors: Record<string, string>;
  /** Parent dari definisi yang sudah terdaftar (draft maupun published). */
  parentOptions: string[];
  /** Ikon menu saat ini (null = bawaan). */
  menuIcon: MenuIcon | null;
  onOpenIconDialog: () => void;
}

function ModuleInfoStep({
  value,
  onChange,
  errors,
  parentOptions,
  menuIcon,
  onOpenIconDialog,
}: ModuleInfoStepProps) {
  const { t } = useTranslation();
  const options = useMemo(
    () => [
      { label: t('config.rootOption'), value: '' },
      ...parentOptions.map((parent) => ({ label: parent, value: parent })),
      { label: t('config.newParent'), value: NEW_PARENT_VALUE },
    ],
    [parentOptions, t],
  );
  const isNewParent = value.parentName === NEW_PARENT_VALUE;
  // Permission mengikuti nama modul sampai user mengubahnya manual.
  const [permissionTouched, setPermissionTouched] = useState(value.permissionKey.trim() !== '');

  function handleModuleNameChange(next: string): void {
    onChange({
      ...value,
      moduleName: next,
      permissionKey: permissionTouched ? value.permissionKey : toPermissionKey(next),
    });
  }

  return (
    <div className="flex flex-col stack-gap">
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Module name</label>
        <TextField
          value={value.moduleName}
          onChange={(e) => handleModuleNameChange(e.target.value)}
          placeholder="Region"
          maxLength={50}
          error={errors.moduleName}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Parent module</label>
        <SelectField
          value={value.parentName}
          onChange={(next) => onChange({ ...value, parentName: next })}
          options={options}
          clearable={false}
          searchable
          error={errors.parentName}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t('config.parentHint')}
        </p>
      </div>
      {isNewParent && (
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            {t('config.newParentName')}
          </label>
          <TextField
            value={value.newParentName}
            onChange={(e) => onChange({ ...value, newParentName: e.target.value })}
            placeholder="administration"
            maxLength={50}
            error={errors.newParentName}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t('config.newParentHint')}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-x-4 stack-gap md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Module type</label>
          <SelectField
            value={value.type}
            onChange={(next) => onChange({ ...value, type: next as ModuleType })}
            options={moduleTypeOptions}
            clearable={false}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Permission key <span className="text-danger">*</span>
          </label>
          <TextField
            value={value.permissionKey}
            onChange={(e) => {
              setPermissionTouched(true);
              onChange({ ...value, permissionKey: e.target.value });
            }}
            placeholder="region"
            maxLength={100}
            error={errors.permissionKey}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {permissionTouched
              ? t('config.permissionTouched')
              : t('config.permissionAuto')}
          </p>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">{t('config.menuIcon')}</label>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
            {menuIcon ? (
              <ModuleMenuIcon name={menuIcon.name} className="h-5 w-5" />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {menuIcon ? menuIcon.name : t('config.defaultIcon')}
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={onOpenIconDialog}>
            {t('config.setIcon')}
          </Button>
        </div>
      </div>
      {value.permissionKey.trim() !== '' && (
        <ul className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground">
          {['view', 'create', 'update', 'delete', 'bulk_upload', 'export'].map((suffix) => (
            <li key={suffix} className="py-0.5">
              {value.permissionKey.trim().toLowerCase()}.{suffix}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ModuleInfoStep;
