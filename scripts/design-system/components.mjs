// Komponen design system "Midas Base". Visual mengikuti kode @midas/ui-base (kelas Tailwind),
// variant & component property = props desain (nama tetap sama dengan versi 1.0.0 supaya tidak breaking).
import { col, frame, icon, instance, row, text } from './build.mjs';

const FG = 'color/foreground', MUTED_FG = 'color/muted-foreground';
const SIZE = { Sm: { h: 30, padX: 12, font: 12, line: 16, icon: 16 }, Md: { h: 42, padX: 16, font: 14, line: 20, icon: 16 }, Lg: { h: 50, padX: 20, font: 16, line: 24, icon: 20 } };
const tone = { Success: 'color/success', Error: 'color/danger', Warning: 'color/warning', Info: 'color/info', Primary: 'color/primary', Secondary: 'color/secondary' };
const actionTone = { View: 'color/info', Edit: 'color/warning', Delete: 'color/danger', Restore: 'color/success' };
const actionIcon = { View: 'eye', Edit: 'pen', Delete: 'trash-bin', Restore: 'restart' };

/**
 * Setiap komponen: name, description, variants, cprops, render(variant, ctx, cp) → spec root variant,
 * states?(ctx) → daftar { label, spec } untuk dokumentasi state (hover, focus, disabled, …).
 * `cp.<Nama>` = id component property (untuk binding teks).
 */
export const COMPONENTS = [
    {
        name: 'Button',
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
        description: 'Status singkat di tabel & detail. Warna mengikuti makna, bukan dekorasi.',
        variants: { Variant: ['Success', 'Error', 'Warning', 'Info', 'Primary', 'Secondary'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Badge' }],
        render: (v, ctx, cp) => badge(v.Variant, ctx, { bind: cp.Label }),
    },
    {
        name: 'Alert',
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
        description: 'Wadah konten dengan judul. Md untuk halaman, Sm untuk panel sempit.',
        variants: { Size: ['Sm', 'Md'] },
        cprops: [{ name: 'Title', type: 'text', default: 'Judul card' }, { name: 'Content', type: 'slot' }],
        render: (v, ctx, cp) => card(v.Size === 'Sm' ? 320 : 400, ctx, { title: 'Judul card', bind: cp.Title, small: v.Size === 'Sm' }, [
            text('Isi card: tabel, form, atau detail.', { color: MUTED_FG, name: 'Content' }),
        ]),
    },
    ...['TextField', 'TextAreaField', 'PasswordField', 'SelectField'].map(name => ({
        name,
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
        render: (v, ctx, cp) => field(name, v.Size, ctx, { bind: cp.Placeholder }),
        states: name === 'TextField' ? ctx => [
            { label: 'Default', spec: field('TextField', 'Md', ctx, { placeholder: 'Nama lengkap' }) },
            { label: 'Terisi', spec: field('TextField', 'Md', ctx, { value: 'Budi Santoso' }) },
            { label: 'Focus', spec: field('TextField', 'Md', ctx, { value: 'Budi', focus: true }) },
            { label: 'Error', spec: col({ gap: 4 }, [field('TextField', 'Md', ctx, { value: 'budi@', error: true }), text('Format email tidak valid', { size: 12, line: 16, color: 'color/danger' })]) },
            { label: 'Disabled', spec: { ...field('TextField', 'Md', ctx, { value: 'Tidak bisa diubah' }), fill: 'color/muted', opacity: 0.7 } },
        ] : null,
    })),
    {
        name: 'CheckboxField',
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
        description: 'Aksi baris tabel (lihat, ubah, hapus, pulihkan). Warna default mengikuti jenis aksi.',
        variants: { Action: ['View', 'Edit', 'Delete', 'Restore'], Color: ['Default', 'Info', 'Warning', 'Danger', 'Success', 'Muted'] },
        cprops: [{ name: 'Disabled', type: 'boolean', default: false }],
        render: (v, ctx) => rowAction(v.Action, v.Color, ctx),
    },
    {
        name: 'PageHeader',
        description: 'Kepala halaman: judul, breadcrumb, dan area kanan (avatar, aksi).',
        variants: {},
        cprops: [{ name: 'Title', type: 'text', default: 'Judul halaman' }, { name: 'Actions', type: 'slot' }],
        render: (_v, ctx, cp) => row({ w: 1184, h: 64, pad: [0, 24], justify: 'between', fill: 'color/background', stroke: 'color/border', strokeSides: [0, 0, 1, 0] }, [
            col({ gap: 2 }, [
                text('Judul halaman', { size: 18, line: 24, weight: 600, bind: cp.Title, name: 'Title' }),
                row({ gap: 4, name: 'Breadcrumb' }, [text('Beranda', { size: 12, line: 16, color: MUTED_FG }), text('/', { size: 12, line: 16, color: MUTED_FG }), text('User', { size: 12, line: 16 })]),
            ]),
            avatar(ctx),
        ]),
    },
    {
        name: 'Table',
        description: 'Daftar data dengan header, aksi baris, dan paginasi. Kolom & data diatur di Code Builder.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => table(ctx, 1096),
    },
    {
        name: 'FilterToolbar',
        description: 'Pencarian + tombol filter di atas tabel.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => row({ w: 1096, gap: 12 }, [
            { ...field('TextField', 'Md', ctx, { placeholder: 'Cari…', leading: 'magnifer' }), w: 'fill' },
            button('Secondary', 'Md', ctx, { label: 'Filter', icon: 'filter' }),
        ]),
    },
    {
        name: 'DetailCard',
        description: 'Detail data read-only: pasangan label & nilai.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => card(480, ctx, { title: 'Detail user' }, [
            col({ w: 'fill', gap: 12 }, [['Nama', 'Budi Santoso'], ['Email', 'budi@contoh.id'], ['Role', 'Administrator'], ['Dibuat', '12/10/2026 09:30']].map(([k, v]) =>
                row({ w: 'fill', gap: 16, align: 'start' }, [text(k, { w: 140, color: MUTED_FG }), text(v, { w: 'fill', weight: 500 })]))),
        ]),
    },
    {
        name: 'Sidebar',
        description: 'Navigasi utama. Item aktif berlatar putih.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => sidebar(ctx, 'Dashboard'),
    },
    {
        name: 'AppShell',
        description: 'Kerangka aplikasi: Sidebar + PageHeader + area konten (latar surface, padding halaman).',
        variants: {},
        cprops: [],
        render: (_v, ctx) => row({ w: 1440, h: 900, align: 'start', fill: 'color/surface', clip: true }, [
            { ...sidebar(ctx, 'Dashboard'), h: 'fill' },
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

export function field(kind, size, ctx, { placeholder = 'Ketik di sini…', value, bind, focus, error, leading } = {}) {
    const s = SIZE[size], area = kind === 'TextAreaField';
    const trailing = kind === 'SelectField' ? 'alt-arrow-down' : kind === 'PasswordField' ? 'eye' : null;
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

function avatar(ctx) {
    return row({ gap: 10, name: 'User' }, [
        col({ gap: 0, align: 'end' }, [text('Hi, Administrator', { size: 14, line: 20, weight: 600 }), text('admin', { size: 12, line: 16, color: MUTED_FG })]),
        row({ w: 36, h: 36, justify: 'center', radius: 999, fill: 'color/primary', fillOpacity: 0.12, name: 'Avatar' }, [text('A', { size: 14, weight: 600, color: 'color/primary' })]),
    ]);
}

export function sidebar(ctx, active) {
    const items = [['Dashboard', 'widget'], ['User', 'user'], ['Role', 'shield-check'], ['Laporan', 'chart']];
    return col({ w: 256, h: 900, pad: [20, 12], gap: 4, fill: 'color/primary', name: 'Sidebar' }, [
        row({ w: 'fill', pad: [4, 12, 20, 12], name: 'Brand' }, [text('Midas App', { size: 18, line: 28, weight: 700, color: 'color/primary-foreground' })]),
        ...items.map(([label, ic]) => {
            const on = label === active;
            return row({ w: 'fill', h: 40, pad: [0, 12], gap: 12, radius: 'radius/lg', fill: on ? 'color/background' : 'none', name: on ? `${label} (aktif)` : label }, [
                icon(ctx.icon(ic, on ? 'bold-duotone' : 'outline', on ? 'color/primary' : 'color/primary-foreground'), { size: 20, name: 'Icon' }),
                text(label, { size: 14, line: 20, weight: 500, color: on ? 'color/primary' : 'color/primary-foreground' }),
            ]);
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
