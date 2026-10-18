// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Badge, Button, FilterToolbar, IconButton, PageHeader, Table, type Column } from '@midas/ui-cms';
import { useRoleList, useDeleteRole } from '../api/queries';
import type { Role } from '../types';

const PAGE_SIZE = 10;
const columns: Column<Role>[] = [
  { key: 'name', header: 'Nama role' },
  { key: 'status', header: 'Status', width: 140, render: (r) => <Badge variant="neutral">{String(r.status)}</Badge> },
];

function RoleListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data } = useRoleList({ page, size: PAGE_SIZE, search });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const remove = useDeleteRole();
  const onDelete = (id: string) => { if (window.confirm(t('common.confirmDelete', { defaultValue: 'Hapus data ini?' }))) remove.mutate(id); };
  return (
    <div data-testid="role-list-page">
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '24px', padding: '24px 24px 24px 24px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-surface, #F8FAFC)', minHeight: '476px' }}>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0px', padding: '0px 0px 0px 0px', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <PageHeader title="Role" description="Atur role dan hak akses pengguna" />
          </div>
          <div style={{ height: '40px', flexShrink: 0 }}>
            <Button variant="primary" size="md" disabled={false} onClick={() => navigate('/role/create')}>{t('role.list.t1')}</Button>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '16px', padding: '20px 20px 20px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-background, #FFFFFF)', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 1px 1px 1px', borderRadius: '8px', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ alignSelf: 'stretch' }}>
            <FilterToolbar searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} />
          </div>
          <div style={{ alignSelf: 'stretch' }}>
            <Table
              columns={columns} data={rows} rowKey={(row) => row.id} totalRecords={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage}
              renderAction={(row) => (<div className="flex gap-1"><IconButton action="view" onClick={() => navigate(`/role/${row.id}`)} /><IconButton action="edit" onClick={() => navigate(`/role/${row.id}/edit`)} /><IconButton action="delete" onClick={() => onDelete(row.id)} /></div>)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoleListPage;
