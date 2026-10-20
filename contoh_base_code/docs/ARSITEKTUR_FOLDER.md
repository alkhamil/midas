# Arsitektur Folder MIDAS — dari Canvas Figma ke Kode Real

> Visi: MIDAS itu clone Figma 100% di sisi canvas, tapi hasilnya bisa di-build jadi codingan real mengikuti satu pakem struktur.
> Dokumen ini hanya menjelaskan pakem output-nya, bukan isi generator/builder. Sengaja dibuat umum, tidak sedetail kode saat ini.

## 1. Ide inti

Secara teknis Figma hanya canvas (gambar). MIDAS menambah satu lapisan: tiap gambar di canvas dipetakan ke struktur pakem, lalu di-generate jadi kode real yang bisa di-run dan di-build.

## 2. Flow project baru

1. UI/UX designer buat project baru di MIDAS.
2. Sistem otomatis buatkan **base project bersih**: sudah ada `package.json` + tooling (Vite, TS, Tailwind, router, query, form), tapi **tanpa components** — belum ada shared UI maupun layout.
3. Designer menggambar bebas di canvas seperti di Figma.
4. Saat butuh komponen nyata (button, table, form, layout), designer ambil dari **design system milik UI/UX**.
5. Publish → MIDAS menulis kode sesuai pakem di bawah → project bisa jalan.

## 3. Components dari mana?

Dari design system UI/UX. Secara teknis design system itu dipublish sebagai **library UI** (versioned), lalu tiap project hanya install dan memakainya. Base project tidak meng-copy komponen, jadi:

- update design system tidak merusak project lama (pindah versi secara eksplisit),
- project baru tetap ringan dan bersih,
- canvas dan kode selalu merujuk ke komponen yang sama.

## 4. Pakem folder output (umum)

```text
project-baru/
├── package.json            # dari base + tambahan library UI design system
├── src/
│   ├── app/                # shell: router, navigation, auth guard
│   ├── modules/            # satu folder per modul bisnis hasil canvas
│   └── shared/             # tipis: theme hook, lib, utils (UI/layout dari library)
```

Aturan arah: modul memakai shared/library, tidak sebaliknya.

### Base code vs library UI

- Base (ikut tiap project baru): `FormGroup`, `FormItem`, `FormArray` — mesin form. `FormGroup` hanya membungkus React Hook Form (`FormProvider` + `<form>`), `FormItem` mengikat field via `Controller`, `FormArray` mengatur `useFieldArray` (append/remove). Tanpa visual khas design system.
- Library UI (versioned, dari design system): input visual (`TextField`, `Select`, ...), layout, dan token thema. Form modul selalu disusun sebagai `FormGroup` > `FormItem`/`FormArray` > komponen library.

## 5. Contoh 1 — modul parent tunggal

Satu modul mandiri, satu level. Bentuk umumnya selalu sama:

```text
modules/<nama-modul>/
├── pages/                  # hasil tiap layar di canvas (list, form, detail)
├── components/             # komposisi komponen library sesuai gambar
├── api/                    # kontrak data/mock per modul
├── hooks/                  # state data per layar
├── types/                  # tipe domain modul
└── i18n/                   # teks en/id
```

## 6. Contoh 2 — parent-child

Parent hanya namespace (grup menu/rute), isi nyata ada di tiap child. Tiap child bentuknya sama seperti Contoh 1:

```text
modules/<nama-induk>/
├── <anak-a>/               # struktur penuh seperti Contoh 1
└── <anak-b>/               # struktur penuh seperti Contoh 1
```

## 7. Yang tidak dibahas di sini

Detail canvas, drag-drop, dan kode builder/generator disengaja tidak ditulis di dokumen ini. Yang penting: apa pun yang digambar, output-nya selalu jatuh ke pakem §4–§6 dengan komponen dari library UI §3.
