// Komponen design system "Midas Base". Visual mengikuti kode @midas/ui-base (kelas Tailwind),
// variant & component property = props desain (nama tetap sama dengan versi 1.0.0 supaya tidak breaking).
import { col, frame, icon, instance, row, text, textWidth } from './build.mjs';

const FG = 'color/foreground', MUTED_FG = 'color/muted-foreground';
const SIZE = { Sm: { h: 30, padX: 12, font: 12, line: 16, icon: 16 }, Md: { h: 42, padX: 16, font: 14, line: 20, icon: 16 }, Lg: { h: 50, padX: 20, font: 16, line: 24, icon: 20 } };
const tone = { Success: 'color/success', Error: 'color/danger', Warning: 'color/warning', Info: 'color/info', Primary: 'color/primary', Secondary: 'color/secondary' };
const actionTone = { View: 'color/info', Edit: 'color/warning', Delete: 'color/danger', Restore: 'color/success' };
const actionIcon = { View: 'eye', Edit: 'pen', Delete: 'trash-bin', Restore: 'restart' };

/**
 * Setiap komponen: name, group (folder page), description, variants, cprops, render(variant, ctx, cp) → spec root variant,
 * states?(ctx) → daftar { label, spec } untuk dokumentasi state (hover, focus, open, disabled, …).
 * `cp.<Nama>` = id component property (untuk binding teks).
 * Nama berawalan `_` = bagian internal (atom yang dirakit komponen lain): ikut library, tidak diekspor ke kode.
 * `page` = page tempat bagian internal didokumentasikan (page komponen pemiliknya).
 * Urutan array = urutan build: komponen yang dipakai sebagai instance harus lebih dulu.
 */
export const COMPONENTS = [
    {
        name: 'Button',
        group: 'Actions',
        description: 'Aksi. Primary untuk aksi utama (satu per area), Secondary untuk aksi pendamping, Danger untuk aksi merusak.',
        variants: { Variant: ['Primary', 'Secondary', 'Danger'], Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Button' }, { name: 'Disabled', type: 'boolean', default: false }, { name: 'Icon', type: 'instance' }],
        render: (v, ctx, cp) => button(v.Variant, v.Size, ctx, { bind: cp.Label }),
        states: ctx => [
            { label: 'Default', spec: button('Primary', 'Md', ctx, { label: 'Simpan' }) },
            { label: 'Hover (bg 85%)', spec: { ...button('Primary', 'Md', ctx, { label: 'Simpan' }), fillOpacity: 0.85 } },
            { label: 'Focus (ring)', spec: { ...button('Primary', 'Md', ctx, { label: 'Simpan' }), stroke: 'color/primary', strokeWidth: 3, strokeAlign: 'outside', props: { strokeOpacity: 0.3 } } },
            { label: 'Disabled (50%)', spec: { ...button('Primary', 'Md', ctx, { label: 'Simpan' }), opacity: 0.5 } },
            { label: 'Dengan ikon', spec: button('Primary', 'Md', ctx, { label: 'Tambah user', icon: 'add' }) },
            { label: 'Secondary + ikon', spec: button('Secondary', 'Md', ctx, { label: 'Export', icon: 'file-text' }) },
        ],
    },
    {
        name: 'Badge',
        group: 'Feedback',
        description: 'Status singkat di tabel & detail. Warna mengikuti makna, bukan dekorasi.',
        variants: { Variant: ['Success', 'Error', 'Warning', 'Info', 'Primary', 'Secondary'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Badge' }],
        render: (v, ctx, cp) => badge(v.Variant, ctx, { bind: cp.Label }),
    },
    {
        name: 'Alert',
        group: 'Feedback',
        description: 'Pesan di dalam halaman/form. Ikon + warna sesuai jenis.',
        variants: { Variant: ['Success', 'Error', 'Warning', 'Info'] },
        cprops: [{ name: 'Message', type: 'text', default: 'Pesan untuk pengguna' }],
        render: (v, ctx, cp) => {
            const c = tone[v.Variant], ic = { Success: 'check-circle', Error: 'close-circle', Warning: 'danger-triangle', Info: 'info-circle' }[v.Variant];
            return row({ w: 400, gap: 12, pad: [12, 16], align: 'start', radius: 'radius/lg', fill: c, fillOpacity: 0.15, stroke: c }, [
                icon(ctx.icon(ic, 'bold-duotone', c), { size: 20, name: 'Icon' }),
                text('Pesan untuk pengguna', { w: 400 - 32 - 20 - 12, size: 14, line: 20, bind: cp.Message, name: 'Message' }),
            ]);
        },
    },
    {
        name: 'Card',
        group: 'Data Display',
        description: 'Wadah konten dengan judul. Md untuk halaman, Sm untuk panel sempit.',
        variants: { Size: ['Sm', 'Md'] },
        cprops: [{ name: 'Title', type: 'text', default: 'Judul card' }, { name: 'Content', type: 'slot' }],
        render: (v, ctx, cp) => card(v.Size === 'Sm' ? 320 : 400, ctx, { title: 'Judul card', bind: cp.Title, small: v.Size === 'Sm' }, [
            text('Isi card: tabel, form, atau detail.', { color: MUTED_FG, name: 'Content' }),
        ]),
    },
    {
        name: 'Avatar',
        group: 'Data Display',
        description: 'Inisial pengguna dalam lingkaran. Dipakai AvatarUser, daftar, dan komentar.',
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Initial', type: 'text', default: 'A' }],
        render: (v, _ctx, cp) => avatar(v.Size, { bind: cp.Initial }),
    },
    {
        name: 'Breadcrumb',
        group: 'Navigation',
        description: 'Jejak halaman. Item berlink berwarna primary, halaman sekarang abu-abu. Item diatur dari kode (items).',
        variants: {},
        cprops: [],
        render: () => breadcrumb(['Beranda', 'Master Data', 'User']),
    },
    {
        name: '_Option',
        page: 'SelectField',
        description: 'Satu baris pilihan di dropdown SelectField / SelectMultipleField.',
        variants: { State: ['Default', 'Hover', 'Selected', 'Disabled'], Type: ['Single', 'Multiple'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Opsi' }],
        render: (v, ctx, cp) => option(v.State, v.Type, ctx, { bind: cp.Label }),
    },
    {
        name: '_Dropdown',
        page: 'SelectField',
        description: 'Panel daftar pilihan (maks. tinggi 240, bisa di-scroll).',
        variants: { Type: ['Single', 'Multiple'] },
        cprops: [],
        render: (v, ctx) => dropdown(v.Type, ctx),
    },
    {
        name: '_Chip',
        page: 'SelectMultipleField',
        description: 'Nilai terpilih di SelectMultipleField, dengan tombol hapus.',
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Admin' }],
        render: (v, ctx, cp) => chip(v.Size, ctx, { bind: cp.Label }),
    },
    ...['TextField', 'TextAreaField', 'PasswordField', 'SelectField'].map(name => ({
        name,
        group: 'Forms',
        description: {
            TextField: 'Input teks satu baris. Label & pesan error dari FormItem.',
            TextAreaField: 'Input teks multi-baris.',
            PasswordField: 'Input kata sandi dengan tombol tampilkan/sembunyikan.',
            SelectField: 'Pilihan dari daftar (dropdown), bisa dicari.',
        }[name],
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [
            { name: 'Placeholder', type: 'text', default: name === 'SelectField' ? 'Pilih…' : 'Ketik di sini…' },
            ...(name === 'TextAreaField' || name === 'PasswordField' ? [] : [{ name: 'Disabled', type: 'boolean', default: false }]),
            { name: 'Error', type: 'text', default: '' },
        ],
        render: (v, ctx, cp) => field(name, v.Size, ctx, { bind: cp.Placeholder, placeholder: name === 'SelectField' ? 'Pilih…' : 'Ketik di sini…' }),
        states: name === 'TextField' ? ctx => [
            { label: 'Default', spec: field('TextField', 'Md', ctx, { placeholder: 'Nama lengkap' }) },
            { label: 'Terisi', spec: field('TextField', 'Md', ctx, { value: 'Budi Santoso' }) },
            { label: 'Focus', spec: field('TextField', 'Md', ctx, { value: 'Budi', focus: true }) },
            { label: 'Error', spec: col({ gap: 4 }, [field('TextField', 'Md', ctx, { value: 'budi@', error: true }), text('Format email tidak valid', { size: 12, line: 16, color: 'color/danger' })]) },
            { label: 'Disabled', spec: { ...field('TextField', 'Md', ctx, { value: 'Tidak bisa diubah' }), fill: 'color/muted', opacity: 0.7 } },
        ] : name === 'SelectField' ? ctx => [
            { label: 'Default', spec: field('SelectField', 'Md', ctx, { placeholder: 'Pilih role' }) },
            { label: 'Terisi', spec: field('SelectField', 'Md', ctx, { value: 'Administrator' }) },
            { label: 'Open', spec: col({ gap: 8 }, [field('SelectField', 'Md', ctx, { value: 'Administrator', focus: true, open: true }), instance(ctx.variant('_Dropdown', { Type: 'Single' }))]) },
            { label: 'Error', spec: col({ gap: 4 }, [field('SelectField', 'Md', ctx, { placeholder: 'Pilih role', error: true }), text('Role wajib diisi', { size: 12, line: 16, color: 'color/danger' })]) },
            { label: 'Disabled', spec: { ...field('SelectField', 'Md', ctx, { value: 'Administrator' }), fill: 'color/muted', opacity: 0.7 } },
        ] : null,
    })),
    {
        name: 'SelectMultipleField',
        group: 'Forms',
        description: 'Banyak pilihan dari daftar; nilai terpilih tampil sebagai chip.',
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Placeholder', type: 'text', default: 'Pilih…' }, { name: 'Disabled', type: 'boolean', default: false }, { name: 'Error', type: 'text', default: '' }],
        render: (v, ctx, cp) => multiField(v.Size, ctx, { bind: cp.Placeholder }),
        states: ctx => [
            { label: 'Kosong', spec: multiField('Md', ctx, { placeholder: 'Pilih role' }) },
            { label: 'Terisi', spec: multiField('Md', ctx, { chips: ['Administrator', 'Editor'] }) },
            { label: 'Open', spec: col({ gap: 8 }, [multiField('Md', ctx, { chips: ['Administrator', 'Editor'], focus: true, open: true }), instance(ctx.variant('_Dropdown', { Type: 'Multiple' }))]) },
            { label: 'Error', spec: col({ gap: 4 }, [multiField('Md', ctx, { placeholder: 'Pilih role', error: true }), text('Pilih minimal satu role', { size: 12, line: 16, color: 'color/danger' })]) },
            { label: 'Disabled', spec: { ...multiField('Md', ctx, { chips: ['Administrator'] }), fill: 'color/muted', opacity: 0.7 } },
        ],
    },
    {
        name: 'CheckboxField',
        group: 'Forms',
        description: 'Satu pilihan ya/tidak dengan label.',
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Checkbox Label', type: 'text', default: 'Setuju' }, { name: 'Disabled', type: 'boolean', default: false }, { name: 'Indeterminate', type: 'boolean', default: false }],
        render: (v, ctx, cp) => checkbox(v.Size, ctx, { bind: cp['Checkbox Label'] }),
        states: ctx => [
            { label: 'Unchecked', spec: checkbox('Md', ctx, { label: 'Aktif' }) },
            { label: 'Checked', spec: checkbox('Md', ctx, { label: 'Aktif', checked: true }) },
            { label: 'Indeterminate', spec: checkbox('Md', ctx, { label: 'Pilih semua', indeterminate: true }) },
            { label: 'Disabled', spec: { ...checkbox('Md', ctx, { label: 'Aktif', checked: true }), opacity: 0.5 } },
        ],
    },
    {
        name: 'SwitchField',
        group: 'Forms',
        description: 'Saklar on/off yang langsung berlaku.',
        variants: { Size: ['Sm', 'Md', 'Lg'] },
        cprops: [{ name: 'Switch Label', type: 'text', default: 'Aktif' }, { name: 'Disabled', type: 'boolean', default: false }],
        render: (v, ctx, cp) => toggle(v.Size, ctx, { bind: cp['Switch Label'] }),
        states: ctx => [
            { label: 'Off', spec: toggle('Md', ctx, { label: 'Notifikasi email' }) },
            { label: 'On', spec: toggle('Md', ctx, { label: 'Notifikasi email', on: true }) },
            { label: 'Disabled', spec: { ...toggle('Md', ctx, { label: 'Notifikasi email', on: true }), opacity: 0.5 } },
        ],
    },
    {
        name: 'Dialog',
        group: 'Feedback',
        description: 'Konfirmasi & form singkat di atas halaman. Lebar dari Max Width.',
        variants: { 'Max Width': ['Sm', 'Md', 'Lg', 'Xl', '2xl'] },
        cprops: [{ name: 'Title', type: 'text', default: 'Judul dialog' }, { name: 'Content', type: 'slot' }],
        render: (v, ctx, cp) => {
            const w = { Sm: 384, Md: 448, Lg: 512, Xl: 576, '2xl': 672 }[v['Max Width']];
            return col({ w, radius: 'radius/xl', fill: 'color/background', stroke: 'color/border', shadow: { x: 0, y: 12, blur: 32, opacity: 0.16 }, clip: true }, [
                row({ w: 'fill', pad: [16, 24], justify: 'between', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Header' }, [
                    text('Judul dialog', { size: 18, line: 28, weight: 600, bind: cp.Title, name: 'Title' }),
                    icon(ctx.icon('close', 'outline', MUTED_FG), { size: 20, name: 'Close' }),
                ]),
                col({ w: 'fill', pad: 24, name: 'Content' }, [text('Data yang dihapus bisa dipulihkan dari daftar data nonaktif.', { w: w - 48, color: MUTED_FG })]),
                row({ w: 'fill', pad: [16, 24], gap: 8, justify: 'end', stroke: 'color/border', strokeSides: [1, 0, 0, 0], name: 'Footer' }, [
                    instance(ctx.variant('Button', { Variant: 'Secondary', Size: 'Md' }), { Label: 'Batal' }),
                    instance(ctx.variant('Button', { Variant: 'Danger', Size: 'Md' }), { Label: 'Hapus' }),
                ]),
            ]);
        },
    },
    {
        name: 'Tooltip',
        group: 'Feedback',
        description: 'Keterangan singkat saat hover/fokus. Hindari teks panjang.',
        variants: { Placement: ['Top', 'Bottom'] },
        cprops: [{ name: 'Content', type: 'text', default: 'Keterangan' }, { name: 'Trigger', type: 'slot' }],
        render: (v, ctx, cp) => {
            const bubble = row({ pad: [8, 12], radius: 'radius/lg', fill: FG, shadow: { x: 0, y: 4, blur: 12, opacity: 0.08 }, name: 'Bubble' }, [
                text('Keterangan', { size: 12, line: 16, weight: 500, color: 'color/background', bind: cp.Content, name: 'Content' }),
            ]);
            const arrow = frame({ w: 8, h: 8, fill: FG, name: 'Arrow', props: { rotation: 45 } });
            return col({ align: 'center', gap: -4 }, v.Placement === 'Top' ? [bubble, arrow] : [arrow, bubble]);
        },
    },
    {
        name: 'RowActionButton',
        group: 'Actions',
        description: 'Aksi baris tabel (lihat, ubah, hapus, pulihkan). Warna default mengikuti jenis aksi.',
        variants: { Action: ['View', 'Edit', 'Delete', 'Restore'], Color: ['Default', 'Info', 'Warning', 'Danger', 'Success', 'Muted'] },
        cprops: [{ name: 'Disabled', type: 'boolean', default: false }],
        render: (v, ctx) => rowAction(v.Action, v.Color, ctx),
    },
    {
        name: 'AvatarUser',
        group: 'Layout',
        description: 'Sapaan + role + Avatar di kanan PageHeader. Klik membuka menu Pengaturan & Keluar.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => avatarUser(ctx),
        states: ctx => [
            { label: 'Default', spec: avatarUser(ctx) },
            { label: 'Hover', spec: { ...avatarUser(ctx), fill: 'color/muted' } },
            { label: 'Menu terbuka', spec: col({ gap: 8, align: 'end' }, [{ ...avatarUser(ctx), fill: 'color/muted' }, userMenu(ctx)]) },
        ],
    },
    {
        name: 'PageHeader',
        group: 'Layout',
        description: 'Kepala halaman: judul, Breadcrumb, dan area kanan (AvatarUser, aksi).',
        variants: {},
        cprops: [{ name: 'Title', type: 'text', default: 'Judul halaman' }, { name: 'Actions', type: 'slot' }],
        render: (_v, ctx, cp) => row({ w: 1184, h: 64, pad: [0, 24], justify: 'between', fill: 'color/background', stroke: 'color/border', strokeSides: [0, 0, 1, 0] }, [
            col({ gap: 2 }, [
                text('Judul halaman', { size: 18, line: 24, weight: 600, bind: cp.Title, name: 'Title' }),
                instance(ctx.root('Breadcrumb')),
            ]),
            instance(ctx.root('AvatarUser')),
        ]),
    },
    {
        name: 'Table',
        group: 'Data Display',
        description: 'Daftar data dengan header, aksi baris, dan paginasi. Kolom & data diatur di Code Builder.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => table(ctx, 1096),
    },
    {
        name: 'FilterToolbar',
        group: 'Layout',
        description: 'Pencarian (lebar 320) di kiri, tombol Filter di kanan. Filter membuka panel field filter.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => row({ w: 1096, justify: 'between' }, [
            { ...field('TextField', 'Md', ctx, { placeholder: 'Cari…', leading: 'magnifer' }), w: 320, name: 'Search' },
            instance(ctx.variant('Button', { Variant: 'Secondary', Size: 'Md' }), { Label: 'Filter' }, { name: 'Filter' }),
        ]),
    },
    {
        name: 'DetailCard',
        group: 'Data Display',
        description: 'Detail data read-only: pasangan label & nilai.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => card(480, ctx, { title: 'Detail user' }, [
            col({ w: 'fill', gap: 12 }, [['Nama', 'Budi Santoso'], ['Email', 'budi@contoh.id'], ['Role', 'Administrator'], ['Dibuat', '12/10/2026 09:30']].map(([k, v]) =>
                row({ w: 'fill', gap: 16, align: 'start' }, [text(k, { w: 140, color: MUTED_FG }), text(v, { w: 'fill', weight: 500 })]))),
        ]),
    },
    {
        name: '_SidebarItem',
        page: 'Sidebar',
        description: 'Item menu sidebar. Aktif: latar putih + ikon bold-duotone. Collapsed: ikon saja.',
        setFill: 'color/primary',
        variants: { State: ['Default', 'Active'], Collapsed: ['false', 'true'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Menu' }],
        render: (v, ctx, cp) => sidebarItem(v.State === 'Active', v.Collapsed === 'true', ctx, { bind: cp.Label }),
    },
    {
        name: 'Sidebar',
        group: 'Navigation',
        description: 'Navigasi utama. Tombol di kanan atas melipat sidebar (256 → 64): menu jadi ikon saja, submenu muncul saat hover.',
        variants: { Collapsed: ['false', 'true'] },
        cprops: [],
        render: (v, ctx) => sidebar(ctx, 'Dashboard', v.Collapsed === 'true'),
    },
    {
        name: 'AppShell',
        group: 'Layout',
        description: 'Kerangka aplikasi: Sidebar + PageHeader + area konten (latar surface, padding halaman).',
        variants: {},
        cprops: [],
        render: (_v, ctx) => row({ w: 1440, h: 900, align: 'start', fill: 'color/surface', clip: true }, [
            instance(ctx.variant('Sidebar', { Collapsed: 'false' })),
            col({ w: 'fill', h: 'fill' }, [
                { ...instance(ctx.root('PageHeader'), { Title: 'Dashboard' }), w: 'fill' },
                col({ w: 'fill', h: 'fill', pad: 24, name: 'Content' }, [
                    frame({ w: 'fill', h: 'fill', radius: 'radius/lg', stroke: 'color/border', props: { strokeStyle: 'dash', strokeDash: 6, strokeGap: 4 }, name: 'Slot konten' }),
                ]),
            ]),
        ]),
    },
];

// ---------------------------------------------------------------- bagian yang dipakai ulang
export function button(variant, size, ctx, { label = 'Button', bind, icon: ic } = {}) {
    const s = SIZE[size];
    const fill = { Primary: 'color/primary', Secondary: 'color/background', Danger: 'color/danger' }[variant];
    const fg = { Primary: 'color/primary-foreground', Secondary: 'color/primary', Danger: '#FFFFFF' }[variant];
    return row({ h: s.h, pad: [0, s.padX - 1], gap: size === 'Lg' ? 10 : size === 'Sm' ? 6 : 8, justify: 'center', radius: size === 'Lg' ? 'radius/xl' : 'radius/lg', fill, stroke: variant === 'Secondary' ? 'color/primary' : fill }, [
        ic ? icon(ctx.icon(ic, 'outline', fg), { size: s.icon, name: 'Icon' }) : null,
        text(label, { size: s.font, line: s.line, weight: 500, color: fg, bind, name: 'Label' }),
    ]);
}

export function badge(variant, ctx, { label = 'Badge', bind } = {}) {
    const solid = variant === 'Primary', neutral = variant === 'Secondary';
    const c = tone[variant];
    return row({ pad: [2, 10], radius: 999, fill: solid ? 'color/primary' : neutral ? 'color/muted' : c, fillOpacity: solid || neutral ? 1 : 0.15 }, [
        text(label, { size: 12, line: 16, weight: 500, color: solid ? 'color/primary-foreground' : neutral ? MUTED_FG : c, bind, name: 'Label' }),
    ]);
}

export function card(w, ctx, { title, bind, small, actions = [] }, body) {
    return col({ w, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', clip: true }, [
        row({ w: 'fill', pad: small ? [12, 16] : [16, 20], justify: 'between', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Header' }, [
            text(title, { size: small ? 14 : 18, line: small ? 20 : 28, weight: 600, bind, name: 'Title' }),
            actions.length ? row({ gap: 8, name: 'Actions' }, actions) : null,
        ]),
        col({ w: 'fill', pad: small ? [12, 16] : [16, 20], gap: 16, name: 'Body' }, body),
    ]);
}

export function field(kind, size, ctx, { placeholder = 'Ketik di sini…', value, bind, focus, error, leading, open } = {}) {
    const s = SIZE[size], area = kind === 'TextAreaField';
    const trailing = kind === 'SelectField' ? (open ? 'alt-arrow-up' : 'alt-arrow-down') : kind === 'PasswordField' ? 'eye' : null;
    return row({ w: 280, h: area ? 88 : s.h, pad: area ? [10, s.padX] : [0, s.padX], gap: 8, align: area ? 'start' : 'center', radius: 'radius/lg', fill: 'color/background',
        stroke: error ? 'color/danger' : focus ? 'color/primary' : 'color/border', strokeWidth: focus ? 2 : 1 }, [
        leading ? icon(ctx.icon(leading, 'outline', MUTED_FG), { size: 16, name: 'Icon' }) : null,
        text(value ?? (kind === 'PasswordField' && !value ? 'Kata sandi' : placeholder), { w: 'fill', size: s.font, line: s.line, color: value ? FG : MUTED_FG, bind: value ? undefined : bind, name: value ? 'Value' : 'Placeholder' }),
        trailing ? icon(ctx.icon(trailing, 'outline', MUTED_FG), { size: 16, name: 'Icon' }) : null,
    ]);
}

function checkbox(size, ctx, { label = 'Setuju', bind, checked, indeterminate } = {}) {
    const box = { Sm: 16, Md: 20, Lg: 24 }[size];
    const on = checked || indeterminate;
    return row({ gap: 8 }, [
        row({ w: box, h: box, justify: 'center', radius: 'radius/sm', fill: on ? 'color/primary' : 'color/background', stroke: on ? 'color/primary' : 'color/border', name: 'Box' }, [
            checked ? icon(ctx.svgAsset('check', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`), { size: box - 6, name: 'Check' }) : null,
            indeterminate ? frame({ w: box - 8, h: 2, radius: 1, fill: '#FFFFFF', name: 'Dash' }) : null,
        ]),
        text(label, { size: 14, line: 20, bind, name: 'Label' }),
    ]);
}

function toggle(size, ctx, { label = 'Aktif', bind, on } = {}) {
    const [w, h, k] = { Sm: [36, 20, 16], Md: [44, 24, 20], Lg: [56, 28, 24] }[size];
    return row({ gap: 8 }, [
        row({ w, h, pad: [0, 2], justify: on ? 'end' : 'start', radius: 999, fill: on ? 'color/primary' : 'color/border', name: 'Track' }, [
            frame({ w: k, h: k, radius: 999, fill: '#FFFFFF', shadow: { x: 0, y: 1, blur: 2, opacity: 0.2 }, name: 'Knob' }),
        ]),
        text(label, { size: 14, line: 20, weight: 500, bind, name: 'Label' }),
    ]);
}

function rowAction(action, color, ctx) {
    const c = color === 'Default' ? actionTone[action] : color === 'Muted' ? MUTED_FG : tone[{ Info: 'Info', Warning: 'Warning', Danger: 'Error', Success: 'Success' }[color]];
    return row({ w: 32, h: 32, justify: 'center', radius: 'radius/md' }, [icon(ctx.icon(actionIcon[action], 'outline', c), { size: 16, name: 'Icon' })]);
}

const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function avatar(size, { initial = 'A', bind } = {}) {
    const d = { Sm: 28, Md: 36, Lg: 44 }[size], f = { Sm: 12, Md: 14, Lg: 16 }[size];
    return row({ w: d, h: d, justify: 'center', radius: 999, fill: 'color/primary', fillOpacity: 0.15, name: 'Avatar' }, [
        text(initial, { size: f, line: Math.round(f * 1.43), weight: 700, color: 'color/primary', bind, name: 'Initial' }),
    ]);
}

function breadcrumb(items) {
    return row({ gap: 4, name: 'Breadcrumb' }, items.flatMap((label, i) => [
        i ? text('/', { size: 12, line: 16, color: MUTED_FG, name: 'Separator' }) : null,
        text(label, { size: 12, line: 16, color: i === items.length - 1 ? MUTED_FG : 'color/primary', name: i === items.length - 1 ? 'Current' : 'Link' }),
    ]));
}

function avatarUser(ctx) {
    return row({ gap: 12, pad: 6, radius: 'radius/lg', name: 'AvatarUser' }, [
        col({ align: 'end' }, [text('Hi, Administrator', { size: 14, line: 20, weight: 500, name: 'Greeting' }), text('admin', { size: 12, line: 16, color: MUTED_FG, name: 'Role' })]),
        instance(ctx.variant('Avatar', { Size: 'Md' }), { Initial: 'A' }),
    ]);
}

function userMenu(ctx) {
    const item = (label, ic, c) => row({ w: 'fill', h: 36, pad: [0, 12], gap: 8, name: label }, [icon(ctx.icon(ic, 'outline', c), { size: 16, name: 'Icon' }), text(label, { size: 14, color: c })]);
    return col({ w: 192, pad: [4, 0], radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', shadow: { x: 0, y: 8, blur: 24, opacity: 0.12 }, name: 'Menu' }, [
        item('Pengaturan', 'settings', FG),
        frame({ w: 'fill', h: 1, fill: 'color/border', name: 'Divider' }),
        item('Keluar', 'logout', 'color/danger'),
    ]);
}

function option(state, type, ctx, { label = 'Opsi', bind } = {}) {
    const selected = state === 'Selected', disabled = state === 'Disabled';
    const c = disabled ? MUTED_FG : selected ? 'color/primary' : FG;
    return row({ w: 280, h: 36, pad: [0, 12], gap: 8, fill: selected ? 'color/primary' : state === 'Hover' ? 'color/muted' : 'none', fillOpacity: selected ? 0.1 : 1, name: 'Option' }, [
        type === 'Multiple' ? row({ w: 16, h: 16, justify: 'center', radius: 'radius/sm', fill: selected ? 'color/primary' : disabled ? 'color/muted' : 'color/background', stroke: selected ? 'color/primary' : 'color/border', name: 'Box' }, [
            selected ? icon(ctx.svgAsset('check', CHECK_SVG), { size: 12, name: 'Check' }) : null,
        ]) : null,
        text(label, { w: 'fill', size: 14, line: 20, weight: selected ? 500 : 400, color: c, bind, name: 'Label' }),
        type === 'Single' && selected ? icon(ctx.svgAsset('check-primary', CHECK_SVG.replace('#FFFFFF', ctx.hex('color/primary')).replace('stroke-width="3"', 'stroke-width="2"')), { size: 16, name: 'Check' }) : null,
    ]);
}

function dropdown(type, ctx) {
    const items = type === 'Multiple'
        ? [['Administrator', 'Selected'], ['Editor', 'Selected'], ['Viewer', 'Hover'], ['Tamu', 'Disabled']]
        : [['Administrator', 'Selected'], ['Editor', 'Hover'], ['Viewer', 'Default'], ['Tamu', 'Disabled']];
    return col({ w: 280, pad: [4, 0], radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', shadow: { x: 0, y: 8, blur: 24, opacity: 0.12 }, clip: true, name: 'Dropdown' },
        items.map(([label, state]) => instance(ctx.variant('_Option', { State: state, Type: type }), { Label: label })));
}

function chip(size, ctx, { label = 'Admin', bind } = {}) {
    const [py, px, f, line] = { Sm: [2, 6, 12, 16], Md: [2, 8, 12, 16], Lg: [4, 8, 14, 20] }[size];
    return row({ pad: [py, px], gap: 2, radius: 999, fill: 'color/muted', name: 'Chip' }, [
        text(label, { size: f, line, weight: 500, bind, name: 'Label' }),
        icon(ctx.icon('close', 'outline', FG), { size: 12, name: 'Remove' }),
    ]);
}

function multiField(size, ctx, { placeholder = 'Pilih…', chips = [], bind, focus, error, open } = {}) {
    const s = SIZE[size];
    return row({ w: 280, h: s.h, pad: [0, s.padX - 4, 0, chips.length ? 6 : s.padX], gap: 8, radius: 'radius/lg', fill: 'color/background',
        stroke: error ? 'color/danger' : focus ? 'color/primary' : 'color/border', strokeWidth: focus ? 2 : 1 }, [
        chips.length
            ? row({ w: 'fill', gap: 4, name: 'Chips' }, chips.map(c => instance(ctx.variant('_Chip', { Size: size }), { Label: c })))
            : text(placeholder, { w: 'fill', size: s.font, line: s.line, color: MUTED_FG, bind, name: 'Placeholder' }),
        icon(ctx.icon(open ? 'alt-arrow-up' : 'alt-arrow-down', 'outline', MUTED_FG), { size: 16, name: 'Icon' }),
    ]);
}

const NAV = [['Dashboard', 'widget'], ['User', 'user'], ['Role', 'shield-check'], ['Laporan', 'chart']];

function sidebarItem(active, collapsed, ctx, { label = 'Menu', bind, ic = 'widget' } = {}) {
    const c = active ? 'color/primary' : 'color/primary-foreground';
    return row({ w: collapsed ? 48 : 240, h: 40, pad: collapsed ? 0 : [0, 12], gap: 12, justify: collapsed ? 'center' : 'start', radius: 'radius/lg', fill: active ? 'color/primary-foreground' : 'none', name: 'SidebarItem' }, [
        icon(ctx.icon(ic, active ? 'bold-duotone' : 'outline', c), { size: 20, name: 'Icon' }),
        collapsed ? null : text(label, { size: 14, line: 20, weight: 500, color: c, bind, name: 'Label' }),
    ]);
}

/** Sidebar dirakit dari instance _SidebarItem (ikon diganti per item lewat override). */
export function sidebar(ctx, active, collapsed = false) {
    const W = collapsed ? 64 : 256, inner = W - 16;
    const brandW = textWidth('Midas App', 18, 700);
    return col({ w: W, h: 900, pad: [0, 8, 8, 8], gap: 4, fill: 'color/primary', name: 'Sidebar' }, [
        frame({ w: inner, h: 88, name: 'Brand' }, [
            collapsed ? null : text('Midas App', { size: 18, line: 28, weight: 700, color: 'color/primary-foreground', x: Math.round((inner - brandW) / 2), y: 30, name: 'App name' }),
            row({ w: 28, h: 28, justify: 'center', radius: 'radius/sm', fill: 'color/primary-foreground', shadow: { x: 0, y: 1, blur: 3, opacity: 0.2 }, x: collapsed ? (inner - 28) / 2 : inner - 28, y: 30, name: 'Toggle' }, [
                icon(ctx.icon(collapsed ? 'double-alt-arrow-right' : 'double-alt-arrow-left', 'outline', 'color/primary'), { size: 14, name: 'Icon' }),
            ]),
        ]),
        ...NAV.map(([label, ic]) => {
            const on = label === active;
            return instance(ctx.variant('_SidebarItem', { State: on ? 'Active' : 'Default', Collapsed: String(collapsed) }), { Label: label }, {
                name: label,
                set: { Icon: { assetId: ctx.icon(ic, on ? 'bold-duotone' : 'outline', on ? 'color/primary' : 'color/primary-foreground') } },
            });
        }),
    ]);
}

export function table(ctx, w, rows = [['Budi Santoso', 'budi@contoh.id', 'Aktif'], ['Ani Wijaya', 'ani@contoh.id', 'Aktif'], ['Citra Lestari', 'citra@contoh.id', 'Nonaktif']]) {
    const cols = [['No', 48], ['Nama', 'fill'], ['Email', 'fill'], ['Status', 120], ['Aksi', 120]];
    const cell = (content, width, header) => row({ w: width, h: header ? 40 : 52, pad: [0, 16], name: 'Cell' }, [content]);
    return col({ w, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', clip: true, name: 'Table' }, [
        row({ w: 'fill', pad: [12, 16], name: 'Total' }, [text('Total Records: ', { size: 14, color: MUTED_FG }), text(String(rows.length), { size: 14, weight: 600 })]),
        row({ w: 'fill', fill: 'color/muted', name: 'Header' }, cols.map(([h, cw]) => cell(text(h, { size: 12, line: 16, weight: 600, color: MUTED_FG }), cw, true))),
        ...rows.map((r, i) => row({ w: 'fill', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: `Row ${i + 1}` }, [
            cell(text(String(i + 1), { color: MUTED_FG }), 48),
            cell(text(r[0], { weight: 500 }), 'fill'),
            cell(text(r[1], { color: MUTED_FG }), 'fill'),
            cell(instance(ctx.variant('Badge', { Variant: r[2] === 'Aktif' ? 'Success' : 'Secondary' }), { Label: r[2] }), 120),
            cell(row({ gap: 4 }, ['View', 'Edit', 'Delete'].map(a => instance(ctx.variant('RowActionButton', { Action: a, Color: 'Default' })))), 120),
        ])),
        row({ w: 'fill', pad: [12, 16], justify: 'between', name: 'Pagination' }, [
            row({ gap: 8 }, [
                row({ h: 32, pad: [0, 10], gap: 6, radius: 'radius/lg', stroke: 'color/border' }, [text('10', { size: 14 }), icon(ctx.icon('alt-arrow-down', 'outline', MUTED_FG), { size: 14 })]),
                text('Baris per halaman', { size: 14, color: MUTED_FG }),
            ]),
            row({ gap: 4 }, [
                icon(ctx.icon('alt-arrow-left', 'outline', MUTED_FG), { size: 16 }),
                row({ w: 32, h: 32, justify: 'center', radius: 'radius/lg', stroke: 'color/primary' }, [text('1', { size: 14, weight: 500, color: 'color/primary' })]),
                icon(ctx.icon('alt-arrow-right', 'outline', MUTED_FG), { size: 16 }),
            ]),
        ]),
    ]);
}
