import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  DetailCard,
  Dialog,
  FilterToolbar,
  FormGroup,
  FormItem,
  FormSkeleton,
  LoadingOverlay,
  Table,
  Tooltip,
  useToast,
  TextField,
  TextAreaField,
  PasswordField,
  SelectField,
  SelectMultipleField,
  RadioGroupField,
  RadioButtonField,
  CheckboxField,
  CheckboxGroupField,
  SwitchField,
  DatePickerField,
  DateRangeField,
  FileUploadField,
  type Column,
} from '../../../shared/components/ui';
import { Pencil, Plus, Eye } from 'lucide-react';
import DocSection from '../components/DocSection';

interface User {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

const ALL_USERS: User[] = Array.from({ length: 27 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  status: i % 3 === 0 ? 'inactive' : 'active',
}));

interface GalleryForm {
  name: string;
  description: string;
  password: string;
  role: string;
  tags: string[];
  gender: string;
  birthDate: string;
  period: string;
  newsletter: boolean;
  agree: boolean;
  interests: string[];
  avatar: File | File[] | null;
}

const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer' },
];

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

const INTEREST_OPTIONS = [
  { label: 'Reading', value: 'reading' },
  { label: 'Sports', value: 'sports' },
  { label: 'Music', value: 'music' },
];

const columns: Column<User>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email', sortable: true },
  {
    key: 'status',
    header: 'Status',
    render: (item) => (
      <Badge variant={item.status === 'active' ? 'success' : 'secondary'}>{item.status}</Badge>
    ),
  },
];

function UiPage() {
  const { showToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overlayOn, setOverlayOn] = useState(false);
  const [singleRadio, setSingleRadio] = useState('a');

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string | undefined>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = ALL_USERS.filter(
      (u) =>
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
        (!filters.status || u.status === filters.status),
    );
    if (sortKey === 'name' || sortKey === 'email') {
      rows = [...rows].sort((a, b) =>
        sortDir === 'asc'
          ? a[sortKey].localeCompare(b[sortKey])
          : b[sortKey].localeCompare(a[sortKey]),
      );
    }
    return rows;
  }, [search, filters, sortKey, sortDir]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function demoOverlay() {
    setOverlayOn(true);
    setTimeout(() => setOverlayOn(false), 1500);
  }

  return (
    <div className="flex flex-col section-gap">
      <DocSection
        title="Button"
        description="Varian primary untuk aksi utama, secondary untuk aksi pendamping. Ukuran sm/md/lg; dukung ikon kiri/kanan dan testId."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button size="sm">Kecil</Button>
          <Button size="lg">Besar</Button>
          <Button icon={<Plus />}>Dengan ikon</Button>
          <Button disabled>Disabled</Button>
        </div>
      </DocSection>

      <DocSection
        title="Alert & Badge"
        description="Alert for block messages (success/info/warning/error). Badge for compact status labels in tables and cards."
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">success</Badge>
          <Badge variant="error">error</Badge>
          <Badge variant="warning">warning</Badge>
          <Badge variant="info">info</Badge>
          <Badge variant="primary">primary</Badge>
          <Badge variant="secondary">secondary</Badge>
        </div>
        <Alert variant="success" message="Data berhasil disimpan." />
        <Alert variant="info" message="Info: ini contoh alert berthema." />
        <Alert variant="warning" message="Perhatian: periksa kembali isian Anda." />
        <Alert variant="error" message="Failed: an error occurred while saving." />
      </DocSection>

      <DocSection
        title="Table + FilterToolbar"
        description="Table generik dengan sortir, paging, aksi baris, dan state kosong/loading/error. FilterToolbar menyediakan pencarian + filter drawer."
      >
        <FilterToolbar
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          filterFields={[
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ],
            },
          ]}
          filterValues={filters}
          onApply={(v) => {
            setFilters(v);
            setPage(1);
          }}
          onReset={() => {
            setFilters({});
            setPage(1);
          }}
        />
        <div className="mt-4">
          <Table<User>
            columns={columns}
            data={paged}
            totalRecords={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            rowKey={(u) => u.id}
            renderAction={(u) => (
              <>
                <button
                  type="button"
                  aria-label={`view-${u.id}`}
                  className="rounded p-1 text-primary hover:bg-primary/10"
                  onClick={() => showToast({ variant: 'info', message: `View ${u.name}` })}
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`edit-${u.id}`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  onClick={() => showToast({ variant: 'success', message: `Edit ${u.name}` })}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </>
            )}
          />
        </div>
      </DocSection>

      <DocSection
        title="Form & all fields"
        description="FormGroup (react-hook-form) + FormItem untuk wiring validasi dan error. Semua 13 komponen field hidup di bawah — submit untuk melihat nilainya di toast."
      >
        <FormGroup<GalleryForm>
          defaultValues={{
            name: '',
            description: '',
            password: '',
            role: '',
            tags: [],
            gender: '',
            birthDate: '',
            period: '',
            newsletter: false,
            agree: false,
            interests: [],
            avatar: null,
          }}
          onSubmit={(data) =>
            showToast({ variant: 'success', message: `Tersimpan: ${data.name || '-'}` })
          }
        >
          <div className="flex flex-col stack-gap">
            <FormItem
              name="name"
              component={TextField}
              label="TextField"
              rules={{ required: 'Name wajib diisi' }}
              placeholder="Full name"
            />
            <FormItem
              name="description"
              component={TextAreaField}
              label="TextAreaField"
              placeholder="Deskripsi panjang"
            />
            <FormItem
              name="password"
              component={PasswordField}
              label="PasswordField"
              placeholder="Kata sandi"
            />
            <FormItem
              name="role"
              component={SelectField}
              label="SelectField"
              options={ROLE_OPTIONS}
              placeholder="Select role"
            />
            <FormItem
              name="tags"
              component={SelectMultipleField}
              label="SelectMultipleField"
              options={ROLE_OPTIONS}
              placeholder="Select multiple"
            />
            <FormItem
              name="gender"
              component={RadioGroupField}
              label="RadioGroupField"
              options={GENDER_OPTIONS}
            />
            <FormItem name="birthDate" component={DatePickerField} label="DatePickerField" />
            <FormItem name="period" component={DateRangeField} label="DateRangeField" />
            <FormItem
              name="newsletter"
              component={SwitchField}
              checkedLabel="Ya, kirim newsletter"
              uncheckedLabel="Tidak"
            />
            <FormItem name="agree" component={CheckboxField} checkboxLabel="CheckboxField: saya setuju" />
            <FormItem
              name="interests"
              component={CheckboxGroupField}
              label="CheckboxGroupField"
              options={INTEREST_OPTIONS}
            />
            <FormItem
              name="avatar"
              component={FileUploadField}
              label="FileUploadField"
              accept=".png,.jpg,.pdf"
            />
            <div>
              <Button type="submit">Submit</Button>
            </div>
          </div>
        </FormGroup>
      </DocSection>

      <DocSection
        title="RadioButtonField"
        description="Satu tombol radio presentasional (dipakai internal oleh RadioGroupField). Dikelola controlled manual."
      >
        <div className="flex items-center gap-4">
          {[
            { label: 'Opsi A', value: 'a' },
            { label: 'Opsi B', value: 'b' },
          ].map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioButtonField
                value={opt.value}
                checked={singleRadio === opt.value}
                onChange={setSingleRadio}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </DocSection>

      <div className="grid section-gap md:grid-cols-2">
        <DocSection
          title="Dialog & Toast & Tooltip"
          description="Dialog modal dengan footer aksi. Toast via useToast(). Tooltip untuk hint hover."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button
              variant="secondary"
              onClick={() => showToast({ variant: 'warning', message: 'Sample warning toast' })}
            >
              Show toast
            </Button>
            <Tooltip content="Themed tooltip">
              <span className="cursor-pointer text-sm text-primary underline">Hover me</span>
            </Tooltip>
          </div>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Sample dialog"
            footer={
              <>
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setDialogOpen(false);
                    showToast({ variant: 'success', message: 'Dialog confirmed' });
                  }}
                >
                  Confirm
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted-foreground">Isi dialog memakai token thema.</p>
          </Dialog>
        </DocSection>

        <DetailCard
          title="DetailCard"
          state={{
            status: 'success',
            rows: [
              { label: 'Name', value: 'Sample Detail' },
              { label: 'Status', value: <Badge variant="success">active</Badge> },
              { label: 'Catatan', value: 'DetailCard berthema.' },
            ],
          }}
        />
      </div>

      <DocSection
        title="LoadingOverlay & FormSkeleton"
        description="LoadingOverlay menutup layar saat proses global. FormSkeleton placeholder saat form edit memuat detail."
      >
        <div>
          <Button variant="secondary" onClick={demoOverlay}>
            Tampilkan overlay 1,5 dtk
          </Button>
        </div>
        {overlayOn && <LoadingOverlay message="Memuat contoh…" />}
        <FormSkeleton />
      </DocSection>

      <DocSection
        title="Helper perilaku"
        description="Komponen non-visual yang dipakai di dalam form dan halaman hasil generate."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-mono text-foreground">NavigationGuard</span> — cegah pindah halaman
            saat form kotor dan belum tersimpan.
          </li>
          <li>
            <span className="font-mono text-foreground">FormArray</span> — baris form dinamis
            tambah/hapus.
          </li>
          <li>
            <span className="font-mono text-foreground">FormDefaultValuesWatcher</span> — reset form
            saat defaultValues async tiba (dipakai mode edit).
          </li>
          <li>
            <span className="font-mono text-foreground">ErrorStatePage</span> — halaman 403/404/500
            (lihat dengan membuka URL ngawur).
          </li>
          <li>
            <span className="font-mono text-foreground">ToastProvider + useToast</span> — notifikasi
            global; provider sudah terpasang di App.
          </li>
        </ul>
      </DocSection>
    </div>
  );
}

export default UiPage;
