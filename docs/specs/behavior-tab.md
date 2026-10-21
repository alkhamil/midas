# Tab Behavior (state mapping, interaction, input)

Tab **Behavior** di inspector kanan editor desain. Isinya **kontekstual**: mengikuti tipe komponen yang
dipilih, bukan satu section generik untuk semua komponen. Tidak ada state hardcoded dari kit
`ui-standard` — setiap nilai state dibaca dari **variable collection** (atau dari nilai manual), jadi
Design dan Preview memakai sumber yang sama.

> Tab ini dulu bernama "Prototype" dan hanya berisi satu section "When clicked". Sekarang isinya
> Stateful: pemetaan state ke variable, pembangun interaction, dan perilaku input field.

Model datanya (canonical) ada di `packages/builder-core/src/behavior.js` — dipakai bersama oleh inspector
desain (`apps/studio/src/engine/midas.js`), live preview (`apps/studio/src/preview/live.js`) dan Code Builder
(`apps/studio/src/codebuilder/*`).

## Kapan tab muncul

Tab Behavior hanya tampil kalau yang dipilih memang salah satu dari:

- **komponen** (main component / variant / component set),
- **instance** komponen,
- **frame** (untuk menAssign peran frame).

## Bagian 1 — State mapping

> *Where do the states get their values?*

Setiap state punya baris: properti yang dipetakan (`Fill`, `Border`, `Radius`, `Text color`, `Opacity`)
lalu sumber nilainya:

| Sumber | Bentuk | Contoh |
| --- | --- | --- |
| Variable | Collection + Variable | `Color` → `color/muted` → `var(--color-muted)` |
| Manual | Nilai langsung | `#4338CA`, `12` |

State yang selalu ditanyakan: `default`, `hover`, `pressed`, `focused`, `disabled` (dan `error` untuk
input field). Designer bisa menambah state sendiri lewat **Custom state name**.

Nilai untuk sebuah properti dicari di rantai fallback, masing-masing untuk propertinya sendiri:
`error → default`, `pressed → hover → default`, `focused → default`, `typing → focused → default`.

Preview memakai nilai yang sama: kalau nilainya dari variable, preview menulis
`var(--<nama-variable>)` (dengan nilai variable sebagai cadangan), jadi Design dan Preview tidak
boleh berbeda.

> Warna state dipakai pada lapisan yang benar-benar membawa tampilan komponen. Kalau instance-nya sendiri
> tidak punya isi / garis (mis. tombol library yang warnanya ada di variant), warnanya dipakai pada
> lapisan pertama di dalamnya yang punya (mis. kotak input pada TextField).

## Bagian 2 — Interaction

> *+ Add interaction* → pilih aksinya.

| Trigger | Arti |
| --- | --- |
| On click | diklik |
| On hover / On mouse enter | kursor masuk |
| On focus / On blur | fokus masuk / keluar |
| On change / On submit | nilai berubah / form disubmit |

| Action | Isi | Peran frame target |
| --- | --- | --- |
| Navigate | `Go to page` | `page` |
| Open dropdown | frame + posisi (top/bottom/left/right + kiri/kanan) | `dropdown` |
| Open overlay | frame + posisi + **backdrop** + tutup saat backdrop diklik | `overlay` |
| Open popover / tooltip | frame + jangkar + posisi | `popover`, `tooltip` |
| Close overlay | `Current overlay` / `All overlays` | — |

Beberapa interaction boleh per komponen (mis. `onClick → Navigate` **dan** `onHover → Open tooltip`).
Target frame hanya menampilkan frame dengan peran yang cocok — peran frame diset di tab Behavior ketika
frame itu dipilih (`page`, `dropdown`, `overlay`, `popover`, `tooltip`).

## Bagian 3 — Input field

Untuk komponen input (`TextField`, `SelectField`, …) tab Behavior menambahkan:

- **Label** — apakah label ada; label menunjuk ke sebuah text layer atau ke variable.
- **Typeable area** — layer mana yang menerima ketikan (label & teks lain tetap read-only), placeholder
  (manual atau variable), dan variable tempat nilainya disimpan (opsional).
- **Error handling** — state yang dipakai saat error, frame error, dan teks bantuan (manual atau variable),
  plus **Required**.

Di preview, mengetik hanya bisa dilakukan pada layer typeable; mengosongkan field yang wajib pada blur
memicu state `error`: frame error ditampilkan, pesannya diisi dari variable / teks manual, dan gaya
border/isi diambil dari state mapping.

## Data model

Disimpan pada node dokumen (`stateMapping`, `interactions`, `inputBehavior`):

```json
{
  "stateMapping": {
    "default": { "fill": { "collectionId": "colors", "variableId": "primary" } },
    "hover": { "fill": { "collectionId": "colors", "variableId": "primary-hover" } },
    "focused": { "border": { "collectionId": "borders", "variableId": "focused" } },
    "error": { "border": { "collectionId": "borders", "variableId": "error" } }
  },
  "interactions": [
    { "id": "i1", "trigger": "onClick", "action": { "type": "navigate", "targetFrameId": "dashboard" } },
    { "id": "i2", "trigger": "onHover", "action": { "type": "open-tooltip", "targetFrameId": "tooltip-login" } }
  ],
  "inputBehavior": {
    "label": { "exists": true, "reference": { "type": "layer", "layerId": "label-email" } },
    "typeable": { "frameId": "input-box", "placeholder": { "variableId": "placeholder-email", "collectionId": "text" } },
    "error": { "stateName": "error", "border": { "collectionId": "borders", "variableId": "error" }, "frameId": "hint-error" },
    "validation": { "required": true }
  }
}
```

Instance memakai miliknya sendiri; kalau kosong, nilainya diambil dari component set / main component.

## Preview runtime

`apps/studio/src/preview/live.js` menjalankan model yang sama:

- state (`hover`, `pressed`, `focused`, `typing`, `filled`, `error`, `disabled`) menentukan nilai yang
  dibaca dari state mapping;
- interaction dijalankan saat trigger-nya cocok: navigasi mengganti frame, dropdown / overlay / popover
  dirender sebagai layer di atas preview (overlay memakai backdrop), Escape menutup layer teratas;
- input: hanya layer typeable yang bisa diketik, frame error muncul pada state `error`.

## Batasan

- State mapping belum ikut dibangkitkan ke kode aplikasi (generator); sekarang baru berlaku di preview.
- `Close overlay` menutup layer yang dibuka interaction; dialog bawaan Code Builder (konfirmasi hapus)
  tetap memakai mekanismenya sendiri.
