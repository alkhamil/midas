// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Badge, Button, FilterToolbar, IconButton, PageHeader, Table, type Column } from '@midas/ui-cms';
import { useUserList, useDeleteUser } from '../api/queries';
import type { User } from '../types';
import { useRoleList } from '../../role/api/queries';

const PAGE_SIZE = 10;

function UserListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data } = useUserList({ page, size: PAGE_SIZE, search });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const roleRel = useRoleList({ page: 1, size: 1000, search: '' }).data?.rows ?? [];
  const columns: Column<User>[] = [
    { key: 'name', header: 'Nama lengkap' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (r) => String(roleRel.find((o) => o.id === r.role)?.name ?? r.role) },
    { key: 'status', header: 'Status', width: 140, render: (r) => <Badge variant="neutral">{String(r.status)}</Badge> },
    { key: 'phone', header: 'Phone', width: 120, render: (r) => <Badge variant={r.phone ? 'success' : 'neutral'}>{r.phone ? 'Aktif' : 'Nonaktif'}</Badge> },
  ];
  const remove = useDeleteUser();
  const onDelete = (id: string) => { if (window.confirm(t('common.confirmDelete', { defaultValue: 'Hapus data ini?' }))) remove.mutate(id); };
  return (
    <div data-testid="user-list-page">
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '24px', padding: '24px 24px 24px 24px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-surface, #F8FAFC)', minHeight: '476px' }}>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0px', padding: '0px 0px 0px 0px', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <PageHeader title="User" description="Kelola akun yang dapat masuk ke aplikasi" />
          </div>
          <div style={{ height: '40px', flexShrink: 0 }}>
            <Button variant="primary" size="md" disabled={false} onClick={() => navigate('/user/create')}>{t('user.list.t1')}</Button>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '16px', padding: '20px 20px 20px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-background, #FFFFFF)', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 1px 1px 1px', borderRadius: '8px', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ alignSelf: 'stretch' }}>
            <FilterToolbar searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} />
          </div>
          <div style={{ alignSelf: 'stretch' }}>
            <Table
              columns={columns} data={rows} rowKey={(row) => row.id} totalRecords={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage}
              renderAction={(row) => (<div className="flex gap-1"><IconButton action="view" onClick={() => navigate(`/user/${row.id}`)} /><IconButton action="edit" onClick={() => navigate(`/user/${row.id}/edit`)} /><IconButton action="delete" onClick={() => onDelete(row.id)} /></div>)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserListPage;
