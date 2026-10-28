# Web Design System: Components, Props and Events

Acuan untuk desainer dan developer tentang komponen web design system Midas.

- **Props** berasal dari desain: variant, component property, slot.
- **Events** tidak ada di desain. Ditulis developer atau datang dari kit perilaku.
- Prioritas: **P1** inti (dibuat dulu), **P2** umum, **P3** nanti.
- Semua komponen punya `className`, `style`, dan `testId`; tidak diulang di tabel.

## Aturan umum

- **Controlled dan uncontrolled:** `value` dan `defaultValue` untuk input, `open` dan `defaultOpen` untuk overlay.
- **Nama event:** `onXxx`, dengan nilai langsung sebagai argumen (`onChange(value)`, bukan event DOM).
- **Slot:** semua yang berupa ikon atau area kustom bertipe `ReactNode`.
- **State:** `hover`, `focus`, `pressed` adalah state visual di desain dan tidak menjadi prop. Yang menjadi prop hanya `disabled`, `loading`, `error`, `readOnly`, `selected`, `checked`.
- **Aksesibilitas:** `ariaLabel` wajib untuk komponen yang hanya berisi ikon.

## Pembagian: statis dan perilaku

- **Bisa dibuat dari desain saja (statis):** Button, Badge, Card, Avatar, Alert, EmptyState, Divider, ListItem, tampilan Table, Skeleton.
- **Butuh perilaku tulisan tangan:** Select, MultiSelect, DatePicker, Dialog, Drawer, Popover, DropdownMenu, Tabs, Accordion, Tooltip, Toast, Combobox.

Urutan pengerjaan: Foundations, lalu Button, TextField, Badge, Card, Alert, lalu Table dan Pagination, lalu Dialog, Select, Tabs, SideNavbar, sisanya.

---

## 1. Foundations (Variables)

| Item | Isi | Prioritas |
|---|---|---|
| Warna | primary, secondary, success, warning, danger, info, background, surface, muted, border, foreground, muted-foreground; skala 25–900; mode Light dan Dark | P1 |
| Tipografi | font family, ukuran, bobot, line-height; style Heading 1–6, Body, Caption, Label, Code | P1 |
| Spacing | skala 4/8/12/16/24/32/48; page padding, card padding, section gap | P1 |
| Radius | sm, md, lg, full | P1 |
| Ikon | set ikon di page `Icons`, ukuran 16/20/24 | P1 |
| Shadow dan elevation | sm, md, lg | P2 |
| Breakpoint dan grid | mobile, tablet, desktop; 12 kolom | P2 |
| Z-index dan motion | lapisan overlay, durasi, easing | P3 |

Nama Variable menentukan nama token: `color/primary-foreground` menjadi `--theme-primary-foreground`, `radius/md` menjadi `--theme-radius-md`.

## 2. Actions

### Button (P1)
| Props | Tipe | Default |
|---|---|---|
| `variant` | primary, secondary, outline, ghost, destructive | primary |
| `size` | sm, md, lg | md |
| `children` / `label` | text | |
| `leadingIcon`, `trailingIcon` | slot | |
| `loading` | boolean | false |
| `disabled` | boolean | false |
| `fullWidth` | boolean | false |
| `type` | button, submit, reset | button |

Events: `onClick`, `onFocus`, `onBlur`.

### IconButton (P1)
Props: `variant`, `size`, `icon` (slot), `disabled`, `loading`, `ariaLabel` (wajib). Events: `onClick`.

### Link (P1)
Props: `variant` (default, muted), `href`, `external`, `leadingIcon`, `disabled`. Events: `onClick`.

### Button Group / Split Button (P3)

## 3. Form

### TextField (P1)
| Props | Tipe |
|---|---|
| `label`, `placeholder`, `helperText`, `errorMessage` | text |
| `value`, `defaultValue` | string |
| `size` | sm, md, lg |
| `state` | default, hover, focus, error, disabled, readOnly |
| `prefix`, `suffix` | slot |
| `required`, `disabled`, `readOnly`, `clearable` | boolean |
| `maxLength` | number |
| `type` | text, email, number, tel, url |

Events: `onChange(value)`, `onFocus`, `onBlur`, `onClear`, `onEnter`.

### Textarea (P1)
Seperti TextField, plus `rows`, `autoResize`, `showCount`. Events: `onChange`, `onFocus`, `onBlur`.

### Select (P1)
Props: `label`, `placeholder`, `options[{value,label,disabled}]`, `value`, `size`, `state`, `searchable`, `clearable`, `disabled`, `required`, `errorMessage`, `emptyText`.
Events: `onChange(value)`, `onSearch(query)`, `onOpenChange(open)`, `onClear`.

### Checkbox (P1)
Props: `label`, `checked`, `indeterminate`, `disabled`, `state`. Events: `onChange(checked)`.

### Radio / RadioGroup (P1)
Props: `options`, `value`, `direction` (horizontal, vertical), `disabled`. Events: `onChange(value)`.

### Switch (P1)
Props: `label`, `checked`, `size`, `disabled`. Events: `onChange(checked)`.

### FormItem (P1)
Props: `label`, `required`, `helperText`, `errorMessage`, `children` (field), `layout` (vertical, horizontal). Tanpa events.

### SearchBar (P1)
Props: `value`, `placeholder`, `size`, `clearable`, `loading`. Events: `onChange`, `onSearch(query)`, `onClear`.

### P2
NumberInput / Quantity, MultiSelect (chip), DatePicker dan DateRange, PasswordInput (tampil/sembunyi), OTP / PIN Input, FileUpload / Dropzone, Combobox / Autocomplete.

### P3
Slider, Rating.

## 4. Data display

### Table (P1)
| Props | Tipe |
|---|---|
| `columns[{key,title,width,align,sortable,render}]` | array |
| `rows` | array |
| `rowKey` | string |
| `selectable` | none, single, multiple |
| `selectedKeys` | array |
| `sort` | `{key, order}` |
| `loading` | boolean |
| `emptyState` | slot |
| `density` | compact, default, comfortable |
| `striped`, `stickyHeader` | boolean |

Events: `onSelectionChange(keys)`, `onSortChange(sort)`, `onRowClick(row)`, `onRowAction(action, row)`.

### TableToolbar (P1)
Props: `title`, `search` (slot), `filters` (slot), `actions` (slot), `selectedCount`. Events: `onSearch`, `onFilterChange`, `onBulkAction`.

### Pagination (P1)
Props: `page`, `pageSize`, `total`, `pageSizeOptions`, `showSizeChanger`, `showTotal`. Events: `onPageChange(page)`, `onPageSizeChange(size)`.

### Badge / Tag (P1)
Props: `variant` (neutral, primary, success, warning, danger, info), `size`, `children`, `icon`, `removable`. Events: `onRemove`.

### Avatar (P1)
Props: `src`, `name` (inisial cadangan), `size` (xs sampai xl), `shape` (circle, square), `status` (online, offline). Events: `onClick`.

### Card (P1)
Props: `variant` (outlined, elevated, filled), `header`, `footer` (slot), `padding`, `clickable`. Events: `onClick`.

### EmptyState (P1)
Props: `icon`, `title`, `description`, `action` (slot), `size`. Tanpa events.

### ListItem (P1)
Props: `title`, `description`, `leading`, `trailing`, `selected`, `disabled`. Events: `onClick`.

### P2
DetailCard / Description List, Accordion, Tooltip, Skeleton, Progress dan Stepper.

### P3
Chart (bar, line, donut), Timeline / Activity Feed.

## 5. Feedback dan overlay

### Alert / Banner (P1)
Props: `variant` (info, success, warning, danger), `title`, `description`, `icon`, `closable`, `action` (slot). Events: `onClose`.

### Toast (P1)
Props: `variant`, `title`, `description`, `duration`, `position`, `action`. Events: `onClose`, `onAction`.

### Dialog (P1)
Props: `open`, `title`, `description`, `size` (sm, md, lg), `footer` (slot), `closeOnOverlayClick`, `closeOnEsc`, `showCloseButton`, `loading`.
Events: `onOpenChange(open)`, `onConfirm`, `onCancel`.

### Spinner / LoadingOverlay (P1)
Props: `size`, `label`, `visible`. Tanpa events.

### Drawer (P2)
Seperti Dialog, plus `side` (left, right). Events sama.

### Popover / Tooltip (P2)
Props: `content`, `placement` (top, bottom, left, right), `trigger` (hover, click, focus), `open`, `delay`. Events: `onOpenChange`.

### DropdownMenu (P2)
Props: `items[{label,icon,disabled,danger,onSelect}]`, `placement`, `trigger`. Events: `onSelect(item)`, `onOpenChange`.

### Popconfirm (P3)

## 6. Navigasi

### SideNavbar (P1)
Props: `items[{label,icon,href,children,badge}]`, `activeKey`, `collapsed`, `header`, `footer`. Events: `onNavigate(item)`, `onCollapseChange`.

### NavItem (P1)
Props: `label`, `icon`, `active`, `badge`, `disabled`, `level`. Events: `onClick`.

### TopBar / Header (P1)
Props: `title`, `breadcrumbs`, `actions` (slot), `userMenu` (slot). Events: `onMenuToggle`.

### Tabs (P1)
Props: `items[{key,label,icon,badge,disabled}]`, `activeKey`, `variant` (underline, pill), `size`. Events: `onChange(key)`.

### Breadcrumbs (P1)
Props: `items[{label,href}]`, `separator`, `maxItems`. Events: `onNavigate`.

### P2
Stepper / Wizard (`steps[{label,description}]`, `current`, `orientation`, `status`; `onStepClick`), SegmentedControl (`options`, `value`, `size`, `fullWidth`; `onChange`).

### P3
Command Palette.

## 7. Layout

### AppShell (P1)
Props: `sidebar`, `topBar`, `children`, `sidebarCollapsed`. Events: `onSidebarToggle`.

### PageHeader (P1)
Props: `title`, `description`, `breadcrumbs`, `actions`, `backButton`. Events: `onBack`.

### PageContent dan SectionHeader (P1)

### P2
Auth Layout dan ErrorPage (403, 404, 500): `title`, `description`, `illustration`, `action`; `onAction`. Divider dan Stack/Grid.
