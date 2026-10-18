// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Button, PageHeader, PasswordField, SelectField, SwitchField, TextField } from '@midas/ui-cms';
import type { UserInput } from '../types';
import { useUserDetail, useUpdateUser } from '../api/queries';
import { validateUser, type UserErrors } from '../validation/userValidation';
import { useRoleList } from '../../role/api/queries';

function UserEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const roleRel = useRoleList({ page: 1, size: 1000, search: '' }).data?.rows ?? [];
  const roleOptions = roleRel.map((r) => ({ label: String(r.name ?? ''), value: r.id }));
  const [errors, setErrors] = useState<UserErrors>({});
  const [values, setValues] = useState<UserInput>({ name: '', email: '', role: '', status: 'active', phone: false });
  const setField = <K extends keyof UserInput>(key: K, value: UserInput[K]) => {
    setValues((v) => ({ ...v, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const { id = '' } = useParams();
  const { data: record } = useUserDetail(id);
  useEffect(() => { if (record) { const { id: _id, ...rest } = record; setValues(rest); } }, [record]);
  const save = useUpdateUser();
  const saving = save.isPending;
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateUser(values, 'edit');
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({ id, input: values }, { onSuccess: () => navigate(-1) });
  };
  return (
    <form onSubmit={onSubmit} data-testid="user-edit-page">
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '24px', padding: '24px 24px 24px 24px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-surface, #F8FAFC)', minHeight: '426px' }}>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0px', padding: '0px 0px 0px 0px', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <PageHeader title="Tambah User" description="Isi data akun baru" />
          </div>
          <div style={{ height: '40px', flexShrink: 0 }}>
            <Button variant="secondary" size="md" disabled={false} type="button" onClick={() => navigate(-1)}>{t('user.edit.t1')}</Button>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '16px', padding: '20px 20px 20px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-background, #FFFFFF)', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 1px 1px 1px', borderRadius: '8px', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '24px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <TextField label="Nama lengkap" placeholder="Mis. Budi Santoso" disabled={false} value={String(values.name ?? '')} onChange={(e) => setField('name', e.target.value)} error={errors.name} />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <TextField label="Email" placeholder="nama@perusahaan.id" disabled={false} value={String(values.email ?? '')} onChange={(e) => setField('email', e.target.value)} error={errors.email} />
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '24px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <SelectField label="Role" placeholder="Pilih role" disabled={false} options={roleOptions} value={String(values.role ?? '')} onChange={(e) => setField('role', e.target.value)} error={errors.role} />
            </div>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <PasswordField label="Kata sandi" placeholder="Minimal 8 karakter" disabled={false} />
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <SwitchField label="Akun aktif" disabled={false} />
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '8px', padding: '16px 0px 0px 0px', justifyContent: 'flex-end', alignItems: 'center', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 0px 0px 0px', alignSelf: 'stretch', flexShrink: 0 }}>
            <div style={{ height: '40px', flexShrink: 0 }}>
              <Button variant="secondary" size="md" disabled={false} type="button" onClick={() => navigate(-1)}>{t('user.edit.t2')}</Button>
            </div>
            <div style={{ height: '40px', flexShrink: 0 }}>
              <Button variant="primary" size="md" type="submit" disabled={saving}>{t('user.edit.t3')}</Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default UserEditPage;
