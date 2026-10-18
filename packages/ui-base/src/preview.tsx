// Contoh props untuk Live DOM Renderer di Midas Studio (Code Builder). Desain hanya membawa props visual
// (variant, label, …); data & callback yang wajib di kode (kolom tabel, menu sidebar, handler) diisi dari sini.
// Kunci = nama export komponen. Tidak dipakai aplikasi.
import type { ReactNode } from 'react';
import { ChartIcon, ShieldCheckIcon, UserIcon, WidgetIcon } from './generated/icons';
import type { NavItemType } from './internal/types/navigation';
import AvatarUser from './components/layout/AvatarUser';
import Badge from './components/ui/Badge';
import RowActionButton from './components/ui/RowActionButton';

const noop = () => {};
const users = [
  { id: 1, name: 'Budi Santoso', email: 'budi@contoh.id', status: 'Aktif' },
  { id: 2, name: 'Ani Wijaya', email: 'ani@contoh.id', status: 'Aktif' },
  { id: 3, name: 'Citra Lestari', email: 'citra@contoh.id', status: 'Nonaktif' },
];
const navItems: NavItemType[] = [
  { label: 'Dashboard', path: '/', icon: <WidgetIcon className="h-5 w-5" /> },
  { label: 'User', path: '/user', icon: <UserIcon className="h-5 w-5" /> },
  { label: 'Role', path: '/role', icon: <ShieldCheckIcon className="h-5 w-5" /> },
  { label: 'Laporan', path: '/laporan', icon: <ChartIcon className="h-5 w-5" /> },
];
const options = [
  { label: 'Administrator', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer' },
];
const user = { name: 'Administrator', roleName: 'admin' };

export const midasPreview: Record<string, Record<string, unknown> & { children?: ReactNode }> = {
  Table: {
    columns: [
      { key: 'name', header: 'Nama' },
      { key: 'email', header: 'Email' },
      { key: 'status', header: 'Status', render: (u: (typeof users)[number]) => <Badge variant={u.status === 'Aktif' ? 'success' : 'secondary'}>{u.status}</Badge> },
    ],
    data: users, totalRecords: users.length, page: 1, pageSize: 10, onPageChange: noop, onPageSizeChange: noop,
    rowKey: (u: (typeof users)[number]) => u.id, showRowNumber: true, actionHeader: 'Aksi',
    renderAction: () => (
      <div className="flex gap-1">
        <RowActionButton action="view" />
        <RowActionButton action="edit" />
        <RowActionButton action="delete" />
      </div>
    ),
  },
  DetailCard: {
    title: 'Detail user',
    state: { status: 'success', rows: [{ label: 'Nama', value: 'Budi Santoso' }, { label: 'Email', value: 'budi@contoh.id' }, { label: 'Role', value: 'Administrator' }] },
  },
  Card: { children: 'Isi card: tabel, form, atau detail.' },
  Dialog: { open: true, onClose: noop, children: 'Data yang dihapus bisa dipulihkan dari daftar data nonaktif.' },
  Tooltip: { children: <span className="text-sm underline decoration-dotted">Arahkan kursor</span> },
  RowActionButton: { action: 'view' },
  TextField: { value: '', onChange: noop },
  TextAreaField: { value: '', onChange: noop },
  PasswordField: { value: '', onChange: noop },
  SelectField: { options, value: '', onChange: noop },
  SelectMultipleField: { options, value: [], onChange: noop },
  CheckboxField: { value: false, onChange: noop },
  SwitchField: { value: false, onChange: noop },
  Breadcrumb: { items: [{ label: 'Beranda', path: '/' }, { label: 'User' }] },
  AvatarUser: { user },
  PageHeader: { breadcrumb: [{ label: 'Beranda', path: '/' }, { label: 'User' }], children: <AvatarUser user={user} /> },
  FilterToolbar: { searchValue: '', onSearchChange: noop, filterFields: [], onApply: noop, onReset: noop },
  Sidebar: { items: navItems, collapsed: false, mobileOpen: false, onToggle: noop, onMobileClose: noop, appName: 'Midas App' },
  AppShell: { navItems, user, appName: 'Midas App' },
};
