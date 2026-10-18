// Foundations design system "CMS" — karakter: tegas, rapi, fokus pada data.
// Sidebar gelap (slate) memisahkan navigasi dari konten; satu aksen indigo; warna status hanya untuk makna.
// Kontras teks ≥ 4.5:1 di kedua tema.

/** Nama paket kode library ini (dipakai teks di page komponen dan script seed). */
export const PACKAGE_NAME = '@midas/ui-cms';

/** Warna semantik: [light, dark]. Nama = token `--theme-<nama>` yang dipakai komponen. */
export const COLORS = {
    primary: ['#4338CA', '#818CF8'],
    'primary-foreground': ['#FFFFFF', '#0B1020'],
    success: ['#15803D', '#4ADE80'],
    warning: ['#B45309', '#FBBF24'],
    danger: ['#B91C1C', '#F87171'],
    info: ['#0369A1', '#38BDF8'],
    background: ['#FFFFFF', '#0F172A'],
    surface: ['#F8FAFC', '#0B1220'],
    muted: ['#F1F5F9', '#1E293B'],
    border: ['#E2E8F0', '#334155'],
    foreground: ['#0F172A', '#F1F5F9'],
    'muted-foreground': ['#64748B', '#94A3B8'],
    sidebar: ['#0F172A', '#020617'],
    'sidebar-foreground': ['#CBD5E1', '#CBD5E1'],
};

/** Penjelasan pemakaian tiap warna (tampil di page Foundations & deskripsi Variable). */
export const COLOR_NOTES = {
    primary: 'Aksi utama, link, fokus, item menu aktif',
    'primary-foreground': 'Teks/ikon di atas primary',
    success: 'Berhasil, aktif',
    warning: 'Perlu perhatian',
    danger: 'Hapus, gagal, error',
    info: 'Informasi',
    background: 'Latar card, dialog, input',
    surface: 'Latar halaman',
    muted: 'Latar hover, header tabel, chip',
    border: 'Garis & pembatas',
    foreground: 'Teks utama',
    'muted-foreground': 'Teks sekunder, placeholder',
    sidebar: 'Latar sidebar',
    'sidebar-foreground': 'Teks & ikon menu di sidebar',
};

/** Radius (px). lg = kontrol (button, input, card); xl = dialog. */
export const RADIUS = { sm: 4, md: 6, lg: 8, xl: 12 };

/** Spacing semantik (px). */
export const SPACING = {
    'page-padding': 24,
    'card-padding': 20,
    'section-gap': 24,
    'stack-gap': 16,
    'field-gap': 12,
};

export const FONT_FAMILY = 'Inter';

/** Skala tipografi (ukuran px / line-height px / weight). Selaras dengan kelas Tailwind di komponen. */
export const TYPE_SCALE = [
    { name: 'Display', size: 30, line: 36, weight: 600, use: 'Angka besar di StatCard' },
    { name: 'Heading 1', size: 24, line: 32, weight: 600, use: 'Judul halaman (text-2xl)' },
    { name: 'Heading 2', size: 18, line: 28, weight: 600, use: 'Judul card & dialog (text-lg)' },
    { name: 'Body', size: 14, line: 20, weight: 400, use: 'Teks utama, isi tabel (text-sm)' },
    { name: 'Body Medium', size: 14, line: 20, weight: 500, use: 'Label tombol & field' },
    { name: 'Small', size: 12, line: 16, weight: 400, use: 'Keterangan, badge, error (text-xs)' },
];

/** Elevasi (bayangan) — hanya untuk elemen yang mengambang di atas halaman. */
export const ELEVATION = [
    { name: 'Level 0', use: 'Card di halaman (hanya border)', shadow: null },
    { name: 'Level 1', use: 'Dropdown, popover', shadow: { x: 0, y: 4, blur: 12, opacity: 0.08 } },
    { name: 'Level 2', use: 'Dialog', shadow: { x: 0, y: 12, blur: 32, opacity: 0.16 } },
];
