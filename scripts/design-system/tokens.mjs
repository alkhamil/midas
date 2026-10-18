// Foundations design system "Midas Base" — karakter: profesional & tenang.
// Netral slate dingin, aksen biru Midas, kontras teks ≥ 4.5:1 di kedua tema, sudut 8px untuk kontrol.

/** Warna semantik: [light, dark]. Nama = token `--theme-<nama>` yang dipakai komponen. */
export const COLORS = {
    primary: ['#0058CA', '#5B9BF5'],
    'primary-foreground': ['#FFFFFF', '#0B1220'],
    secondary: ['#475569', '#94A3B8'],
    'secondary-foreground': ['#FFFFFF', '#0B1220'],
    success: ['#15803D', '#4ADE80'],
    warning: ['#B45309', '#FBBF24'],
    danger: ['#C62828', '#F87171'],
    info: ['#0369A1', '#38BDF8'],
    background: ['#FFFFFF', '#0B1220'],
    surface: ['#F5F7FA', '#111A2B'],
    muted: ['#E9EDF3', '#1E293B'],
    border: ['#D5DCE5', '#2B384C'],
    foreground: ['#0F172A', '#E6EBF2'],
    'muted-foreground': ['#5B6677', '#9AA6B8'],
};

/** Penjelasan pemakaian tiap warna (tampil di page Foundations & deskripsi Variable). */
export const COLOR_NOTES = {
    primary: 'Aksi utama, link, fokus, elemen aktif',
    'primary-foreground': 'Teks/ikon di atas primary',
    secondary: 'Aksi & status netral',
    'secondary-foreground': 'Teks/ikon di atas secondary',
    success: 'Berhasil, aktif',
    warning: 'Perlu perhatian',
    danger: 'Hapus, gagal, error',
    info: 'Informasi',
    background: 'Latar kartu, dialog, input',
    surface: 'Latar halaman',
    muted: 'Latar hover, header tabel, chip',
    border: 'Garis & pembatas',
    foreground: 'Teks utama',
    'muted-foreground': 'Teks sekunder, placeholder',
};

/** Radius (px). lg = kontrol (button, input, card); xl = dialog. */
export const RADIUS = { sm: 4, md: 6, lg: 8, xl: 12 };

/** Spacing semantik (px) — dipakai class .page-padding, .stack-gap, .field-gap, padding card. */
export const SPACING = {
    'page-padding': 16, 'page-padding-lg': 24,
    'card-padding-x': 20, 'card-padding-y': 16,
    'section-gap': 24, 'stack-gap': 16, 'field-gap': 12,
};

export const FONT_FAMILY = 'Inter';

/** Skala tipografi (ukuran px / line-height px / weight). Selaras dengan kelas Tailwind di komponen. */
export const TYPE_SCALE = [
    { name: 'Display', size: 30, line: 36, weight: 600, use: 'Angka besar dashboard' },
    { name: 'Heading 1', size: 24, line: 32, weight: 600, use: 'Judul halaman (text-2xl)' },
    { name: 'Heading 2', size: 18, line: 28, weight: 600, use: 'Judul card & dialog (text-lg)' },
    { name: 'Heading 3', size: 16, line: 24, weight: 600, use: 'Sub judul (text-base)' },
    { name: 'Body', size: 14, line: 20, weight: 400, use: 'Teks utama, isi tabel (text-sm)' },
    { name: 'Body Medium', size: 14, line: 20, weight: 500, use: 'Label tombol & field' },
    { name: 'Small', size: 12, line: 16, weight: 400, use: 'Keterangan, badge, error (text-xs)' },
];

/** Elevasi (bayangan) — dipakai card mengambang, dropdown, dialog, tooltip. */
export const ELEVATION = [
    { name: 'Level 0', use: 'Card di halaman (hanya border)', shadow: null },
    { name: 'Level 1', use: 'Dropdown, popover, tooltip', shadow: { x: 0, y: 4, blur: 12, opacity: 0.08 } },
    { name: 'Level 2', use: 'Dialog & drawer', shadow: { x: 0, y: 12, blur: 32, opacity: 0.16 } },
];

export const light = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v[0]]));
export const dark = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v[1]]));
