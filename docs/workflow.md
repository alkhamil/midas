# Workflow Midas

Midas adalah editor desain (canvas, komponen, variabel). Library dipakai untuk **membagikan komponen dan variabel antar file desain** di workspace yang sama.

```
 DESAINER A                          DESAINER B
┌─────────────────────────┐  publish ┌──────────────────────────┐
│ 1. File design system   │ ───────► │ 2. File lain menambah    │
│    + Publish as library │          │    library, memakai      │
└─────────────────────────┘          │    komponen & variabel   │
                                     └──────────────────────────┘
```

## 1. Publish library (Studio)

1. Buat file desain berisi komponen (dengan variant dan component property) dan variabel (warna, radius, dst).
   - Komponen yang namanya diawali `_` atau `.` adalah **bagian internal**: dipakai komponen lain, ikut dibagikan, tapi tidak muncul sendiri.
   - Nama dengan `/` menjadi folder (mis. `Icon/Arrow/Left`).
2. Buka **Assets**, lalu **Publish as library**. Isi nama library dan catatan rilis (opsional), pilih komponen yang dibagikan (ada pencarian dan Select all / none), lalu **Publish**.
3. Setiap publish menjadi **versi bernomor** (1, 2, 3, ...). Komponen yang dibutuhkan komponen terpilih (instance di dalamnya) ikut terkirim.

## 2. Memakai library di file lain

1. Di file lain buka **Assets**, lalu pada bagian **Libraries** tekan **Add** di library yang diinginkan.
2. Variabel library masuk ke file itu, dan komponennya muncul di Assets untuk dipasang.
3. Saat library punya versi baru, tombol **Update** muncul. Update menyamakan salinan komponen yang sudah dipakai.
4. **Remove** melepas library; komponen dan variabel yang sudah dipakai tetap ada di file itu.

Unpublish (hapus library) tersedia dari halaman Home, bagian Library. File sumbernya tetap ada.

## Disimpan di mana

| Apa | Tempat |
|---|---|
| File desain, folder, page, akun, sesi | Postgres |
| Record library dan versi | Postgres (`libraries`, `library_versions`) |
| Snapshot tiap versi (komponen, variabel, aset) | S3/R2: `libraries/<id>/<versi>.json` |
| Library yang dipakai tiap file | Postgres (`file_libraries`) |
| Gambar desain | S3/R2, metadata di Postgres (`assets`) |

Server tidak menyimpan data sendiri, jadi boleh di-redeploy kapan saja.
