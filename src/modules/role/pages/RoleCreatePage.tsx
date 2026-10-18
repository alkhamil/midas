// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, PageHeader, SwitchField, TextAreaField, TextField } from '@midas/ui-cms';
import type { RoleInput } from '../types';
import { useCreateRole } from '../api/queries';
import { validateRole, type RoleErrors } from '../validation/roleValidation';

function RoleCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<RoleErrors>({});
  const [values, setValues] = useState<RoleInput>({ name: '', description: '', status: 'active' });
  const setField = <K extends keyof RoleInput>(key: K, value: RoleInput[K]) => {
    setValues((v) => ({ ...v, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const save = useCreateRole();
  const saving = save.isPending;
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateRole(values, 'create');
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate(values, { onSuccess: () => navigate(-1) });
  };
  return (
    <form onSubmit={onSubmit} data-testid="role-create-page">
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '24px', padding: '24px 24px 24px 24px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-surface, #F8FAFC)', minHeight: '482px' }}>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0px', padding: '0px 0px 0px 0px', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <PageHeader title="Tambah Role" description="Isi data role baru" />
          </div>
          <div style={{ height: '40px', flexShrink: 0 }}>
            <Button variant="secondary" size="md" disabled={false} type="button" onClick={() => navigate(-1)}>{t('role.create.t1')}</Button>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '16px', padding: '20px 20px 20px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-background, #FFFFFF)', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 1px 1px 1px', borderRadius: '8px', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ alignSelf: 'stretch' }}>
            <TextField label="Nama role" placeholder="Mis. Editor" disabled={false} value={String(values.name ?? '')} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
          </div>
          <div style={{ alignSelf: 'stretch' }}>
            <TextAreaField label="Deskripsi" placeholder="Jelaskan hak akses role ini" disabled={false} value={String(values.description ?? '')} onChange={(e) => setField('description', e.target.value)} />
          </div>
          <div style={{ flexShrink: 0 }}>
            <SwitchField label="Role aktif" disabled={false} />
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '8px', padding: '16px 0px 0px 0px', justifyContent: 'flex-end', alignItems: 'center', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 0px 0px 0px', alignSelf: 'stretch', flexShrink: 0 }}>
            <div style={{ height: '40px', flexShrink: 0 }}>
              <Button variant="secondary" size="md" disabled={false} type="button" onClick={() => navigate(-1)}>{t('role.create.t2')}</Button>
            </div>
            <div style={{ height: '40px', flexShrink: 0 }}>
              <Button variant="primary" size="md" type="submit" disabled={saving}>{t('role.create.t3')}</Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default RoleCreatePage;
