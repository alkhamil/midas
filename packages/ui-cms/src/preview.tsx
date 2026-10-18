// Contoh props untuk Live DOM Renderer di Midas Studio (Code Builder). Desain hanya membawa props visual
// (variant, label, …); data & callback yang wajib di kode (kolom tabel, menu sidebar, handler) diisi dari sini.
// Kunci = nama export komponen. Tidak dipakai aplikasi.
import { ChartIcon, ShieldCheckIcon, UserIcon, WidgetIcon } from './generated/icons';
import { Badge } from './components/Badge/Badge';
import { IconButton } from './components/IconButton/IconButton';
import type { NavItem } from './components/Sidebar/Sidebar';

const noop = () => {};
const users = [
  { id: 1, name: 'Budi Santoso', email: 'budi@contoh.id', role: 'Administrator', status: 'Aktif' },
  { id: 2, name: 'Ani Wijaya', email: 'ani@contoh.id', role: 'Editor', status: 'Aktif' },
  { id: 3, name: 'Citra Lestari', email: 'citra@contoh.id', role: 'Viewer', status: 'Nonaktif' },
];
const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <WidgetIcon className="h-5 w-5" /> },
  { label: 'User', path: '/user', icon: <UserIcon className="h-5 w-5" /> },
  { label: 'Role', path: '/role', icon: <ShieldCheckIcon className="h-5 w-5" /> },
];
const options = [
  { label: 'Administrator', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer' },
];

export const midasPreview: Record<string, Record<string, unknown>> = {
  Table: {
    columns: [
      { key: 'name', header: 'Nama' },
      { key: 'email', header: 'Email' },
      { key: 'role', header: 'Role', width: 160 },
      { key: 'status', header: 'Status', width: 120, render: (u: (typeof users)[number]) => <Badge variant={u.status === 'Aktif' ? 'success' : 'neutral'}>{u.status}</Badge> },
    ],
    data: users,
    rowKey: (u: (typeof users)[number]) => u.id,
    totalRecords: users.length,
    page: 1,
    pageSize: 10,
    onPageChange: noop,
    renderAction: () => (
      <div className="flex gap-1">
        <IconButton action="view" />
        <IconButton action="edit" />
        <IconButton action="delete" />
      </div>
    ),
  },
  Sidebar: { items: navItems, activePath: '/', appName: 'CMS Admin', onToggle: noop },
  AppShell: { navItems, activePath: '/', user: { name: 'Administrator', roleName: 'admin' }, title: 'Dashboard', breadcrumbs: [{ label: 'Beranda', path: '/' }, { label: 'Dashboard' }], appName: 'CMS Admin' },
  Topbar: { breadcrumbs: [{ label: 'Beranda', path: '/' }, { label: 'User' }] },
  SelectField: { options },
  FilterToolbar: { searchValue: '', onSearchChange: noop, onFilterClick: noop },
  Dialog: { open: true, onClose: noop, children: 'Data yang dihapus tidak dapat dikembalikan.' },
  Card: { children: 'Isi card: tabel, form, atau detail.' },
  StatCard: { label: 'Total user', value: '1.248', caption: '12% dari bulan lalu' },
};
