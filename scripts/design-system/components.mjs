// Komponen design system CMS. Setiap komponen: name, group (folder page), description, variants, cprops,
// render(variant, ctx, cp) → spec root variant, states?(ctx) → daftar { label, spec } untuk dokumentasi state.
// `cp.<Nama>` = id component property (untuk binding teks). Nama berawalan `_` = bagian internal (dirakit komponen
// lain, tidak diekspor ke kode). Urutan array = urutan build: komponen yang dipakai sebagai instance harus lebih dulu.
import { col, frame, icon, instance, row, text } from './build.mjs';

const FG = 'color/foreground', MUTED_FG = 'color/muted-foreground', STYLE = 'outline';
const SIZE = { Sm: { h: 32, padX: 12, font: 12, line: 16 }, Md: { h: 40, padX: 16, font: 14, line: 20 } };
const tone = { Success: 'color/success', Warning: 'color/warning', Danger: 'color/danger', Info: 'color/info' };
const ico = (ctx, name, color, size = 16) => icon(ctx.icon(name, STYLE, color), { size, name: 'Icon' });

export const COMPONENTS = [
    {
        name: 'Button',
        group: 'Actions',
        description: 'Aksi. Primary untuk aksi utama (satu per area), Secondary untuk pendamping, Ghost untuk aksi ringan, Danger untuk aksi merusak.',
        variants: { Variant: ['Primary', 'Secondary', 'Ghost', 'Danger'], Size: ['Sm', 'Md'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Button' }, { name: 'Disabled', type: 'boolean', default: false }, { name: 'Icon', type: 'instance' }],
        render: (v, ctx, cp) => button(v.Variant, v.Size, ctx, { bind: cp.Label }),
        states: ctx => [
            { label: 'Default', spec: button('Primary', 'Md', ctx, { label: 'Simpan' }) },
            { label: 'Hover (85%)', spec: { ...button('Primary', 'Md', ctx, { label: 'Simpan' }), fillOpacity: 0.85 } },
            { label: 'Disabled (50%)', spec: { ...button('Primary', 'Md', ctx, { label: 'Simpan' }), opacity: 0.5 } },
            { label: 'Dengan ikon', spec: button('Primary', 'Md', ctx, { label: 'Tambah user', icon: 'add' }) },
            { label: 'Secondary + ikon', spec: button('Secondary', 'Md', ctx, { label: 'Filter', icon: 'filter' }) },
        ],
    },
    {
        name: 'IconButton',
        group: 'Actions',
        description: 'Aksi baris tabel: lihat, ubah, hapus. Hanya ikon — beri tooltip/aria-label di kode.',
        variants: { Action: ['View', 'Edit', 'Delete'] },
        cprops: [{ name: 'Disabled', type: 'boolean', default: false }],
        render: (v, ctx) => iconButton(v.Action, ctx),
    },
    {
        name: 'Badge',
        group: 'Feedback',
        description: 'Status singkat di tabel & detail. Warna mengikuti makna, bukan dekorasi.',
        variants: { Variant: ['Success', 'Warning', 'Danger', 'Info', 'Neutral'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Badge' }],
        render: (v, _ctx, cp) => badge(v.Variant, { bind: cp.Label }),
    },
    {
        name: 'Avatar',
        group: 'Data Display',
        description: 'Inisial pengguna dalam lingkaran.',
        variants: { Size: ['Sm', 'Md'] },
        cprops: [{ name: 'Initial', type: 'text', default: 'A' }],
        render: (v, _ctx, cp) => avatar(v.Size, { bind: cp.Initial }),
    },
    {
        name: 'Alert',
        group: 'Feedback',
        description: 'Pesan di dalam halaman atau form. Ikon + warna sesuai jenis.',
        variants: { Variant: ['Success', 'Warning', 'Danger', 'Info'] },
        cprops: [{ name: 'Message', type: 'text', default: 'Pesan untuk pengguna' }],
        render: (v, ctx, cp) => {
            const c = tone[v.Variant], ic = { Success: 'check-circle', Warning: 'danger-triangle', Danger: 'close-circle', Info: 'info-circle' }[v.Variant];
            return row({ w: 480, gap: 12, pad: [12, 16], align: 'start', radius: 'radius/lg', fill: c, fillOpacity: 0.1, stroke: c }, [
                ico(ctx, ic, c, 20),
                text('Pesan untuk pengguna', { w: 480 - 32 - 20 - 12, size: 14, line: 20, bind: cp.Message, name: 'Message' }),
            ]);
        },
    },
    {
        name: 'Card',
        group: 'Data Display',
        description: 'Wadah konten dengan judul. Dipakai untuk tabel, form, dan detail.',
        variants: {},
        cprops: [{ name: 'Title', type: 'text', default: 'Judul card' }, { name: 'Content', type: 'slot' }],
        render: (_v, _ctx, cp) => card(480, { title: 'Judul card', bind: cp.Title }, [text('Isi card: tabel, form, atau detail.', { color: MUTED_FG, name: 'Content' })]),
    },
    {
        name: 'StatCard',
        group: 'Data Display',
        description: 'Angka ringkasan di dashboard dengan tren naik, turun, atau netral.',
        variants: { Trend: ['Up', 'Down', 'Neutral'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Total user' }, { name: 'Value', type: 'text', default: '1.248' }, { name: 'Caption', type: 'text', default: '12% dari bulan lalu' }],
        render: (v, ctx, cp) => {
            const c = { Up: 'color/success', Down: 'color/danger', Neutral: MUTED_FG }[v.Trend];
            return col({ w: 260, gap: 8, pad: 20, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border' }, [
                text('Total user', { size: 14, line: 20, color: MUTED_FG, bind: cp.Label, name: 'Label' }),
                text('1.248', { size: 30, line: 36, weight: 600, bind: cp.Value, name: 'Value' }),
                row({ gap: 4, name: 'Trend' }, [
                    v.Trend === 'Neutral' ? null : ico(ctx, v.Trend === 'Up' ? 'arrow-up' : 'arrow-down', c, 14),
                    text('12% dari bulan lalu', { size: 12, line: 16, weight: 500, color: c, bind: cp.Caption, name: 'Caption' }),
                ]),
            ]);
        },
    },
    ...['TextField', 'TextAreaField', 'PasswordField', 'SelectField'].map(name => ({
        name,
        group: 'Forms',
        description: {
            TextField: 'Input teks satu baris dengan label. Pesan error tampil di bawah input.',
            TextAreaField: 'Input teks multi-baris dengan label.',
            PasswordField: 'Input kata sandi dengan tombol tampilkan/sembunyikan.',
            SelectField: 'Pilihan dari daftar (dropdown) dengan label.',
        }[name],
        variants: {},
        cprops: [
            { name: 'Label', type: 'text', default: { TextField: 'Nama lengkap', TextAreaField: 'Catatan', PasswordField: 'Kata sandi', SelectField: 'Role' }[name] },
            { name: 'Placeholder', type: 'text', default: name === 'SelectField' ? 'Pilih…' : 'Ketik di sini…' },
            { name: 'Disabled', type: 'boolean', default: false },
        ],
        render: (_v, ctx, cp) => formField(name, ctx, { bindLabel: cp.Label, bindPlaceholder: cp.Placeholder }),
        states: ctx => [
            { label: 'Default', spec: formField(name, ctx, { label: 'Label', placeholder: 'Placeholder' }) },
            { label: 'Terisi', spec: formField(name, ctx, { label: 'Label', value: name === 'PasswordField' ? '••••••••' : 'Budi Santoso' }) },
            { label: 'Focus', spec: formField(name, ctx, { label: 'Label', value: 'Budi', focus: true }) },
            { label: 'Error', spec: formField(name, ctx, { label: 'Label', value: 'budi@', error: 'Format tidak valid' }) },
            { label: 'Disabled', spec: { ...formField(name, ctx, { label: 'Label', value: 'Tidak bisa diubah' }), opacity: 0.5 } },
            ...(name === 'SelectField' ? [{ label: 'Open', spec: selectOpen(ctx) }] : []),
        ],
    })),
    {
        name: 'SwitchField',
        group: 'Forms',
        description: 'Saklar on/off yang langsung berlaku, mis. status aktif.',
        variants: {},
        cprops: [{ name: 'Label', type: 'text', default: 'Aktif' }, { name: 'Disabled', type: 'boolean', default: false }],
        render: (_v, _ctx, cp) => toggle({ bind: cp.Label }),
        states: () => [
            { label: 'Off', spec: toggle({ label: 'Akun aktif' }) },
            { label: 'On', spec: toggle({ label: 'Akun aktif', on: true }) },
            { label: 'Disabled', spec: { ...toggle({ label: 'Akun aktif', on: true }), opacity: 0.5 } },
        ],
    },
    {
        name: 'Dialog',
        group: 'Feedback',
        description: 'Konfirmasi atau form singkat di atas halaman.',
        variants: { Size: ['Sm', 'Md'] },
        cprops: [{ name: 'Title', type: 'text', default: 'Judul dialog' }, { name: 'Content', type: 'slot' }],
        render: (v, ctx, cp) => {
            const w = { Sm: 400, Md: 520 }[v.Size];
            return col({ w, radius: 'radius/xl', fill: 'color/background', stroke: 'color/border', shadow: { x: 0, y: 12, blur: 32, opacity: 0.16 }, clip: true }, [
                row({ w: 'fill', pad: [16, 24], justify: 'between', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Header' }, [
                    text('Judul dialog', { size: 18, line: 28, weight: 600, bind: cp.Title, name: 'Title' }),
                    ico(ctx, 'close', MUTED_FG, 20),
                ]),
                col({ w: 'fill', pad: 24, name: 'Content' }, [text('Data yang dihapus tidak dapat dikembalikan.', { w: w - 48, color: MUTED_FG })]),
                row({ w: 'fill', pad: [16, 24], gap: 8, justify: 'end', stroke: 'color/border', strokeSides: [1, 0, 0, 0], name: 'Footer' }, [
                    instance(ctx.variant('Button', { Variant: 'Secondary', Size: 'Md' }), { Label: 'Batal' }),
                    instance(ctx.variant('Button', { Variant: 'Danger', Size: 'Md' }), { Label: 'Hapus' }),
                ]),
            ]);
        },
    },
    {
        name: 'Table',
        group: 'Data Display',
        description: 'Daftar data dengan header, aksi baris, dan paginasi. Kolom & data diatur di Code Builder.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => table(ctx, 960),
    },
    {
        name: '_SidebarItem',
        page: 'Sidebar',
        description: 'Item menu sidebar. Aktif: latar primary. Collapsed: ikon saja.',
        setFill: 'color/sidebar',
        variants: { State: ['Default', 'Active'], Collapsed: ['false', 'true'] },
        cprops: [{ name: 'Label', type: 'text', default: 'Menu' }],
        render: (v, ctx, cp) => sidebarItem(v.State === 'Active', v.Collapsed === 'true', ctx, { bind: cp.Label }),
    },
    {
        name: 'Sidebar',
        group: 'Navigation',
        description: 'Navigasi utama berlatar gelap. Tombol di kepala melipat sidebar (256 → 72): menu jadi ikon saja.',
        variants: { Collapsed: ['false', 'true'] },
        cprops: [],
        render: (v, ctx) => sidebar(ctx, 'Dashboard', v.Collapsed === 'true'),
    },
    {
        name: 'PageHeader',
        group: 'Layout',
        description: 'Kepala halaman di dalam konten: judul dan keterangan. Tombol aksi utama ditaruh di sampingnya sebagai Button terpisah.',
        variants: {},
        cprops: [{ name: 'Title', type: 'text', default: 'Judul halaman' }, { name: 'Description', type: 'text', default: 'Keterangan singkat halaman' }, { name: 'Actions', type: 'slot' }],
        render: (_v, ctx, cp) => row({ w: 960, justify: 'between', align: 'center' }, [
            col({ gap: 4 }, [
                text('Judul halaman', { size: 24, line: 32, weight: 600, bind: cp.Title, name: 'Title' }),
                text('Keterangan singkat halaman', { size: 14, line: 20, color: MUTED_FG, bind: cp.Description, name: 'Description' }),
            ]),
            // Slot aksi dibiarkan kosong: tombol aksi halaman ditaruh desainer di samping header (sebagai instance Button terpisah).
            row({ gap: 8, name: 'Actions' }, []),
        ]),
    },
    {
        name: 'FilterToolbar',
        group: 'Layout',
        description: 'Pencarian (lebar 320) di kiri, tombol Filter di kanan, di atas tabel.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => row({ w: 960, justify: 'between' }, [
            { ...formField('TextField', ctx, { placeholder: 'Cari…', leading: 'magnifer', bare: true }), w: 320, name: 'Search' },
            instance(ctx.variant('Button', { Variant: 'Secondary', Size: 'Md' }), { Label: 'Filter' }, { name: 'Filter' }),
        ]),
    },
    {
        name: 'AppShell',
        group: 'Layout',
        description: 'Kerangka aplikasi: Sidebar + topbar (judul & pengguna) + area konten berlatar surface.',
        variants: {},
        cprops: [],
        render: (_v, ctx) => row({ w: 1440, h: 900, align: 'start', fill: 'color/surface', clip: true }, [
            instance(ctx.variant('Sidebar', { Collapsed: 'false' })),
            col({ w: 'fill', h: 'fill' }, [
                row({ w: 'fill', h: 64, pad: [0, 24], justify: 'between', fill: 'color/background', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Topbar' }, [
                    text('Dashboard', { size: 16, line: 24, weight: 600, name: 'Title' }),
                    row({ gap: 12, name: 'User' }, [
                        col({ align: 'end' }, [text('Administrator', { size: 14, line: 20, weight: 500 }), text('admin', { size: 12, line: 16, color: MUTED_FG })]),
                        instance(ctx.variant('Avatar', { Size: 'Md' }), { Initial: 'A' }),
                    ]),
                ]),
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
    const fill = { Primary: 'color/primary', Secondary: 'color/background', Ghost: 'none', Danger: 'color/danger' }[variant];
    const fg = { Primary: 'color/primary-foreground', Secondary: FG, Ghost: FG, Danger: '#FFFFFF' }[variant];
    const stroke = { Primary: fill, Danger: fill, Secondary: 'color/border' }[variant];
    return row({ h: s.h, pad: [0, s.padX - 1], gap: 8, justify: 'center', radius: 'radius/lg', fill, stroke }, [
        ic ? icon(ctx.icon(ic, STYLE, fg), { size: 16, name: 'Icon' }) : null,
        text(label, { size: s.font, line: s.line, weight: 500, color: fg, bind, name: 'Label' }),
    ]);
}

function iconButton(action, ctx) {
    const [name, c] = { View: ['eye', MUTED_FG], Edit: ['pen', MUTED_FG], Delete: ['trash-bin', 'color/danger'] }[action];
    return row({ w: 32, h: 32, justify: 'center', radius: 'radius/md' }, [ico(ctx, name, c)]);
}

export function badge(variant, { label = 'Badge', bind } = {}) {
    const neutral = variant === 'Neutral', c = tone[variant];
    return row({ pad: [2, 10], radius: 999, fill: neutral ? 'color/muted' : c, fillOpacity: neutral ? 1 : 0.12 }, [
        text(label, { size: 12, line: 16, weight: 500, color: neutral ? MUTED_FG : c, bind, name: 'Label' }),
    ]);
}

export function avatar(size, { initial = 'A', bind } = {}) {
    const d = { Sm: 28, Md: 36 }[size], f = { Sm: 12, Md: 14 }[size];
    return row({ w: d, h: d, justify: 'center', radius: 999, fill: 'color/primary', fillOpacity: 0.12, name: 'Avatar' }, [
        text(initial, { size: f, line: Math.round(f * 1.43), weight: 700, color: 'color/primary', bind, name: 'Initial' }),
    ]);
}

export function card(w, { title, bind, actions = [] }, body) {
    return col({ w, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', clip: true }, [
        row({ w: 'fill', pad: [16, 20], justify: 'between', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: 'Header' }, [
            text(title, { size: 18, line: 28, weight: 600, bind, name: 'Title' }),
            actions.length ? row({ gap: 8, name: 'Actions' }, actions) : null,
        ]),
        col({ w: 'fill', pad: 20, gap: 16, name: 'Body' }, body),
    ]);
}

/** Field berlabel: label di atas, kotak input, pesan error di bawah (bila ada). `bare` = tanpa label (mis. pencarian). */
export function formField(kind, ctx, { label = 'Label', bindLabel, placeholder = 'Ketik di sini…', bindPlaceholder, value, focus, error, leading, bare } = {}) {
    const area = kind === 'TextAreaField';
    const trailing = kind === 'SelectField' ? 'alt-arrow-down' : kind === 'PasswordField' ? 'eye' : null;
    const shown = value ?? (kind === 'PasswordField' && !value ? 'Kata sandi' : placeholder);
    const box = row({ w: 'fill', h: area ? 96 : 40, pad: area ? [10, 12] : [0, 12], gap: 8, align: area ? 'start' : 'center', radius: 'radius/lg', fill: 'color/background',
        stroke: error ? 'color/danger' : focus ? 'color/primary' : 'color/border', strokeWidth: focus ? 2 : 1, name: 'Input' }, [
        leading ? ico(ctx, leading, MUTED_FG) : null,
        text(shown, { w: 'fill', size: 14, line: 20, color: value ? FG : MUTED_FG, bind: value ? undefined : bindPlaceholder, name: value ? 'Value' : 'Placeholder' }),
        trailing ? ico(ctx, trailing, MUTED_FG) : null,
    ]);
    return col({ w: 320, gap: 6 }, [
        bare ? null : text(label, { size: 14, line: 20, weight: 500, bind: bindLabel, name: 'Label' }),
        box,
        error ? text(error, { size: 12, line: 16, color: 'color/danger', name: 'Error' }) : null,
    ]);
}

function selectOpen(ctx) {
    const items = [['Administrator', true], ['Editor', false], ['Viewer', false]];
    return col({ gap: 8 }, [
        formField('SelectField', ctx, { label: 'Role', value: 'Administrator', focus: true }),
        col({ w: 320, pad: [4, 0], radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', shadow: { x: 0, y: 4, blur: 12, opacity: 0.08 }, name: 'Dropdown' },
            items.map(([label, on]) => row({ w: 'fill', h: 36, pad: [0, 12], fill: on ? 'color/primary' : 'none', fillOpacity: 0.1, name: label }, [text(label, { size: 14, line: 20, weight: on ? 500 : 400, color: on ? 'color/primary' : FG })]))),
    ]);
}

function toggle({ label = 'Aktif', bind, on } = {}) {
    return row({ gap: 8 }, [
        row({ w: 40, h: 22, pad: [0, 2], justify: on ? 'end' : 'start', radius: 999, fill: on ? 'color/primary' : 'color/border', name: 'Track' }, [
            frame({ w: 18, h: 18, radius: 999, fill: '#FFFFFF', shadow: { x: 0, y: 1, blur: 2, opacity: 0.2 }, name: 'Knob' }),
        ]),
        text(label, { size: 14, line: 20, weight: 500, bind, name: 'Label' }),
    ]);
}

const NAV = [['Dashboard', 'widget'], ['User', 'user'], ['Role', 'shield-check']];

function sidebarItem(active, collapsed, ctx, { label = 'Menu', bind, ic = 'widget' } = {}) {
    const c = active ? 'color/primary-foreground' : 'color/sidebar-foreground';
    return row({ w: collapsed ? 48 : 232, h: 40, pad: collapsed ? 0 : [0, 12], gap: 12, justify: collapsed ? 'center' : 'start', radius: 'radius/lg', fill: active ? 'color/primary' : 'none', name: 'SidebarItem' }, [
        ico(ctx, ic, c, 20),
        collapsed ? null : text(label, { size: 14, line: 20, weight: 500, color: c, bind, name: 'Label' }),
    ]);
}

/** Sidebar dirakit dari instance _SidebarItem (ikon diganti per item lewat override). */
export function sidebar(ctx, active, collapsed = false) {
    const W = collapsed ? 72 : 256;
    return col({ w: W, h: 900, pad: [0, 12, 12, 12], gap: 4, fill: 'color/sidebar', name: 'Sidebar' }, [
        row({ w: 'fill', h: 72, pad: collapsed ? 0 : [0, 4], justify: collapsed ? 'center' : 'between', name: 'Brand' }, [
            collapsed ? null : row({ gap: 10 }, [
                row({ w: 32, h: 32, justify: 'center', radius: 'radius/lg', fill: 'color/primary', name: 'Logo' }, [text('C', { size: 16, line: 24, weight: 700, color: 'color/primary-foreground' })]),
                text('CMS Admin', { size: 16, line: 24, weight: 600, color: '#FFFFFF', name: 'App name' }),
            ]),
            row({ w: 28, h: 28, justify: 'center', radius: 'radius/md', stroke: 'color/sidebar-foreground', name: 'Toggle' }, [
                ico(ctx, collapsed ? 'double-alt-arrow-right' : 'double-alt-arrow-left', 'color/sidebar-foreground', 14),
            ]),
        ]),
        ...NAV.map(([label, ic]) => {
            const on = label === active;
            return instance(ctx.variant('_SidebarItem', { State: on ? 'Active' : 'Default', Collapsed: String(collapsed) }), { Label: label }, {
                name: label,
                set: { Icon: { assetId: ctx.icon(ic, STYLE, on ? 'color/primary-foreground' : 'color/sidebar-foreground') } },
            });
        }),
    ]);
}

export function table(ctx, w, rows = [['Budi Santoso', 'budi@contoh.id', 'Administrator', 'Aktif'], ['Ani Wijaya', 'ani@contoh.id', 'Editor', 'Aktif'], ['Citra Lestari', 'citra@contoh.id', 'Viewer', 'Nonaktif']]) {
    const cols = [['Nama', 'fill'], ['Email', 'fill'], ['Role', 160], ['Status', 120], ['Aksi', 144]];
    const cell = (content, width, header) => row({ w: width, h: header ? 40 : 52, pad: [0, 16], name: 'Cell' }, [content]);
    return col({ w, radius: 'radius/lg', fill: 'color/background', stroke: 'color/border', clip: true, name: 'Table' }, [
        row({ w: 'fill', fill: 'color/muted', name: 'Header' }, cols.map(([h, cw]) => cell(text(h, { size: 12, line: 16, weight: 600, color: MUTED_FG }), cw, true))),
        ...rows.map((r, i) => row({ w: 'fill', stroke: 'color/border', strokeSides: [0, 0, 1, 0], name: `Row ${i + 1}` }, [
            cell(text(r[0], { weight: 500 }), 'fill'),
            cell(text(r[1], { color: MUTED_FG }), 'fill'),
            cell(text(r[2]), 160),
            cell(instance(ctx.variant('Badge', { Variant: r[3] === 'Aktif' ? 'Success' : 'Neutral' }), { Label: r[3] }), 120),
            cell(row({ gap: 4 }, ['View', 'Edit', 'Delete'].map(a => instance(ctx.variant('IconButton', { Action: a })))), 144),
        ])),
        row({ w: 'fill', pad: [12, 16], justify: 'between', name: 'Pagination' }, [
            text(`Menampilkan 1–${rows.length} dari ${rows.length}`, { size: 14, line: 20, color: MUTED_FG }),
            row({ gap: 4 }, [
                ico(ctx, 'alt-arrow-left', MUTED_FG),
                row({ w: 32, h: 32, justify: 'center', radius: 'radius/lg', stroke: 'color/primary' }, [text('1', { size: 14, weight: 500, color: 'color/primary' })]),
                ico(ctx, 'alt-arrow-right', MUTED_FG),
            ]),
        ]),
    ]);
}
