# Tab Behavior (state mapping, interaction, input)

Tab **Behavior** di inspector kanan editor desain. Isinya **kontekstual**: mengikuti tipe komponen yang
dipilih, bukan satu section generik untuk semua komponen. Tidak ada state hardcoded dari kit
`ui-standard` — setiap nilai state dibaca dari **variable collection** (atau dari nilai manual), jadi
Design dan Preview memakai sumber yang sama.

> Tab ini dulu bernama "Prototype" dan hanya berisi satu section "When clicked". Sekarang isinya
> Stateful: pemetaan state ke variable, pembangun interaction, dan perilaku input field.

Model datanya (canonical) ada di `packages/builder-core/src/behavior.js` — dipakai bersama oleh inspector
desain (`apps/studio/src/engine/midas.js`), dan live preview (`apps/studio/src/preview/live.js`). Code Builder
sudah dihapus dari Midas. Logika baru (State, ekspresi, migrasi) ditulis sebagai fungsi murni di builder-core, bukan di
`midas.js`.

> **Dua arti kata "state".** *State mapping* (Bagian 1) adalah keadaan tampilan sebuah komponen (hover, pressed, error)
> yang dibaca dari mode variable collection. *State* (bagian "Variables: Tokens dan State") adalah **nilai yang berubah
> saat halaman berjalan** (teks yang diketik, daftar baris, opsi terpilih). Keduanya bertemu lewat **Option state yang
> menggerakkan mode** sebuah komponen.

## Kapan tab muncul

Tab Behavior hanya tampil kalau yang dipilih memang salah satu dari:

- **komponen** (main component / variant / component set),
- **instance** komponen,
- **frame** (untuk menAssign peran frame).

## Bagian 1 — State mapping

> *Nilai state dibaca dari variable collection yang disambungkan ke layer ini.*

State **tidak** ditulis manual per komponen. Yang terjadi:

1. Designer membuat **variable collection** dengan nama state (mis. **Button states**) dan mode
   `Default / Hover / Pressed / Focused / Disabled / Error`. Mode = state.
2. Di tab Behavior, collection itu **disambungkan** ke instance/komponen (tombol *Connect a collection*; membuka
   jendela pemilih yang sama dengan pemilih variable di Design, lengkap dengan pencarian dan filter library).
3. Variable yang terikat ke layer (mis. `button/fill` di collection **Button states**) otomatis punya
   nilai per state. Tab Behavior menampilkannya apa adanya:

```
Button states                                    ×
  Default            mode Default
  Fill   ▣ #4338CA   button/fill
  + Override a property
  Hover              mode Hover
  Fill   ▣ #F1F5F9    button/fill
  + Override a property
  Pressed            mode Pressed
  Fill   ▣ #1E293B    button/fill
```

Jadi **state = mode**, dan **nilai = variable**. Tidak ada warna hardcoded dari kit `ui-standard`.

Kalau belum ada collection state, tab Behavior mengarahkan: buat di jendela Variables, atau sambungkan
collection yang sudah ada. **Override** dipakai kalau satu state perlu nilai lain (collection + variable
lain, atau nilai manual) — nilainya menimpa nilai dari collection.

### Pilih mode untuk tiap state

Setiap state punya dropdown **mode**. Designer yang menentukan state mana memakai mode mana, jadi nama mode
bebas. Pilihan **Automatic** hanya menebak dari nama mode (urutan prioritas nama, bukan urutan di collection),
dan disimpan di `stateModes` (`{ [collectionId]: { [state]: modeId } }`).

Daftar state di panel mengikuti collection: setiap mode yang namanya dikenal menjadi satu baris, ditambah state
inti untuk jenis komponennya (Default, Hover, Pressed, Focused, Disabled; untuk input juga Selected, Typing, Filled,
Error). State yang dikenal (nama mode, tanpa membedakan huruf besar/kecil):

| State | Nama mode | Kapan Preview memakainya |
|---|---|---|
| Default | `default` | diam |
| Hover / Pressed | `hover`, `pressed` | pointer di atas / ditekan |
| Focused | `focused`, `focus` | fokus lewat keyboard (Tab) |
| Selected | `selected`, `current`, `checked` | field diklik (input); atau dicentang / terbuka / current lewat *Set active / selected* |
| Typing / Filled | `typing`, `filled` | sedang mengetik / keluar dari field dengan isi |
| Error | `error`, `error-empty`, `error-filled` | gagal validasi: `error-empty` kalau kosong, `error-filled` kalau berisi |
| Disabled | `disabled`, `disabled-off`, `disabled-on` | dinonaktifkan; `-on` kalau sedang selected |
| Gabungan | `selected-hover` (`current-hover`), `focused-selected` (`current-focused`), `focused-indeterminate`, `indeterminate` | selected + hover, selected + focus, dst. |
| Lainnya | `read-only`, `empty`, `loading`, `success`, `today`, `filtered`, `uploading`, `uploaded`, `destructive`, `upcoming`, `completed`, `active`, `inactive` | bisa dipetakan; Preview belum memasukinya sendiri |

Rantai fallback bila mode sebuah state tidak ada: `pressed → hover → default`, `error-empty / error-filled → error →
default`, `focused-selected → focused → selected → default`, `selected → focused → default`, `disabled-on / -off →
disabled → default`, `default → inactive → empty`.

Setiap state adalah baris yang bisa dibuka-tutup (ringkasannya menampilkan mode yang dipakai); bagian dalamnya
berisi dropdown mode, nilai variable (hanya tampilan baca, dilipat), dan override. Baris yang sedang terbuka tetap
terbuka saat panel digambar ulang.

Collection dianggap "collection state" kalau namanya menyebut state (`/state/i`) atau punya beberapa mode
yang berarti state (hover / pressed / focused / …). Collection tema (Light/Dark) bukan state.

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

| Action | Isi | Target |
| --- | --- | --- |
| Navigate | `Go to page` | frame berperan `page` |
| Open dropdown | **component** + posisi (top/bottom/left/right + kiri/kanan) | component |
| Open overlay | **component** + posisi + **backdrop** + tutup saat backdrop diklik | component |
| Open popover / tooltip | **component** + jangkar + posisi | component |
| Close overlay | `Current overlay` / `All overlays` | — |

Satu interaction punya satu **trigger** dan satu atau lebih **action** yang dijalankan berurutan
(`actions: []`; `action` tunggal dari file lama dibaca sebagai action pertama). Contoh menu item: *On click →
Close overlay, Set variable, Navigate*. Beberapa interaction boleh per komponen.

Dua action tambahan:

- **Set variable** — pilih **variable collection**, lalu **mode**-nya. Pemilih collection memakai jendela yang sama
  dengan pemilih variable di Design (pencarian, filter library, satu baris per collection); begitu collection dipilih,
  mode pertamanya langsung dipakai. Selama Preview terbuka seluruh file membaca mode itu,
  jadi semua layer yang terikat ke variable di collection tersebut ikut berubah sekaligus (mis. `Button states` →
  `pressed`). Satu collection bisa punya beberapa mode; mode yang dipilih di sini menang atas mode dari state mapping.
- **Set active / selected** — memberi layer ini keadaan *selected* (dicentang / terbuka / current): **Toggle**
  (balik: nyala kalau tadi mati, mati kalau tadi nyala — checkbox), **Select** (nyalakan dan biarkan nyala — switch),
  atau **Select only this one** (nyalakan, lalu matikan yang lain dengan component sama di parent yang sama — radio
  group / tab row). Tampilannya memakai mode `selected` (atau `current`, `checked`), `selected-hover`,
  `focused-selected`, `disabled-on`.

Preview menjalankan interaction pada layer paling dalam yang punya interaction untuk trigger itu: klik pada instance
bersarang tidak ikut menjalankan interaction milik induknya.

**Component juga punya Interaction.** Interaction yang diatur pada main component (atau component set) otomatis
dipakai semua instance-nya. Instance baru tidak menyalin interaction komponen; ia membacanya dari komponen, jadi
perubahan berikutnya langsung terasa. Begitu sebuah instance punya interaction sendiri, instance itu berhenti
mengikuti komponen dan memakai daftarnya sendiri (tombol **Edit them on this instance** menyalin daftar komponen
sebagai titik awal). Daftar yang diwarisi tampil read-only di tab Behavior.

Dropdown, overlay, dan popover membuka sebuah **component** (`targetComponentId`), bukan frame. Memilihnya
memakai jendela yang sama dengan *Swap instance*: pohon yang bisa dicari, di mana setiap page adalah folder dan
setiap bagian nama `Folder / Sub / Nama` juga folder di dalamnya. Folder tertutup, kecuali jalur menuju component
yang sedang dipilih (dan semua folder yang berisi hasil pencarian). Component set dibuka sebagai variant
pertamanya. Interaction lama yang menunjuk frame (`targetFrameId`) tetap jalan sampai diganti component.

Dropdown dan popover punya **Placement** (`top-start`, `top`, `top-end`, `right-start`, `right`,
`right-end`, `bottom-start`, `bottom`, `bottom-end`, `left-start`, `left`, `left-end`) dan **Offset**
(px dari component yang membukanya). Nama sudut lama (`bottom-left` dst.) dibaca sebagai padanannya. Layer yang
dibuka lewat **On hover** / **On mouse enter** tertutup saat pointer tidak lagi berada di atas pemicunya maupun
layer itu, dan tidak menumpuk saat pemicunya digambar ulang; layer yang dibuka lewat klik menutup saat dipicu lagi.

## Bagian 3 — Input field

Untuk komponen input (`TextField`, `SelectField`, …) tab Behavior menambahkan:

- **Typeable area** — layer mana yang menerima ketikan (label & teks lain tetap read-only). **Input type**
  (Text / Email / Password / Number) dipilih designer, tidak ditebak dari nama layer; default Text. Untuk Password,
  designer memilih dua **component** ikon: **Icon while hidden** (mis. mata tertutup) dan **Icon while shown**
  (mis. mata terbuka). Ikon di field yang merupakan instance salah satunya di-swap antara keduanya saat diklik di
  Preview, dan teks ditampilkan / disembunyikan. Mengklik field yang sudah berisi memulai Typing dengan caret di
  akhir teks. **Required** juga ada di sini.
- **Validate** — kapan field diperiksa: **On blur** (default), **On change** (setiap ketikan), atau **On submit**
  (saat Enter). Hasilnya selalu state: `error-empty` kalau wajib tapi kosong, `error-filled` kalau isinya tidak
  cocok dengan tipe (email, angka). Tampilan error datang dari State mapping, bukan dari frame error manual.

Label, placeholder, dan nilai yang diketik diatur di tab Appearance (lewat variable), bukan di Behavior.

Layer yang punya interaction **On click** (atau target halaman) memakai kursor pointer di Preview, dan field yang
punya interaction seperti itu tidak dianggap bisa diketik kecuali layer typeable-nya dipilih eksplisit.
Di preview, mengetik hanya bisa dilakukan pada layer typeable. Meninggalkan field wajib yang belum pernah diisi
kembali ke `default`; mengosongkan field yang sempat berisi (atau isi yang tidak cocok dengan tipenya) memicu state
`error-empty` / `error-filled` sesuai trigger **Validate**.

## Data model

Disimpan pada node dokumen (`stateMapping` = override, `interactions`, `inputBehavior`, plus
`varModes` untuk collection yang disambungkan):

```json
{
  "varModes": { "button-states": "mode-default" },
  "vars": { "fill": "button-fill" },
  "stateModes": { "button-states": { "pressed": "mode-pressed" } },
  "stateMapping": {
    "hover": { "fill": { "collectionId": "colors", "variableId": "primary-hover" } }
  },
  "interactions": [
    { "id": "i1", "trigger": "onClick", "actions": [
      { "type": "close-overlay", "close": "current" },
      { "type": "set-variable", "collectionId": "button-states", "modeId": "mode-selected" },
      { "type": "navigate", "targetFrameId": "dashboard" }
    ] },
    { "id": "i2", "trigger": "onHover", "actions": [{ "type": "open-popover", "targetComponentId": "tooltip-login", "position": "top", "offset": 8 }] }
  ],
  "inputBehavior": {
    "typeable": { "frameId": "input-box", "inputType": "email" },
    "validation": { "required": true, "trigger": "blur" }
  }
}
```

`stateMapping` hanya berisi **override**; nilai utama state dibaca dari variable collection
(`vars` + `varModes`). Instance memakai miliknya sendiri; kalau kosong, nilainya diambil dari
component set / main component. Hal yang sama berlaku untuk `interactions`: daftar milik instance
yang tidak kosong menang, selain itu preview dan tab Behavior memakai daftar component set /
main component.

## Preview runtime

`apps/studio/src/preview/live.js` menjalankan model yang sama:

- Preview **mulai dari state yang sedang tampil di canvas**: mode variable collection yang dipilih di panel Variables
  (`varModes`) menentukan state awal instance (mis. mode `Hover` → state `hover`, mode `Selected` → `selected`).
  Preview tidak memaksakan state `default`; setelah sebuah interaksi mengubahnya, state kembali ke state canvas
  (bukan `default`) saat pointer pergi / blur.
- state (`hover`, `pressed`, `focused`, `typing`, `filled`, `error`, `disabled`) menentukan nilai yang
  dibaca dari state mapping;
- interaction dijalankan saat trigger-nya cocok: navigasi mengganti frame, dropdown / overlay / popover
  dirender sebagai layer di atas preview (overlay memakai backdrop), Escape menutup layer teratas;
- input: hanya layer typeable yang bisa diketik, frame error muncul pada state `error`. Meninggalkan field wajib
  yang belum pernah diisi kembali ke `default`; error hanya muncul kalau teks sempat diisi lalu dikosongkan.

Preview dibuka dengan tombol **play** di header dan memenuhi jendela (tanpa panel editor). Satu tombol menu kecil
di pojok kiri atas membuka sidebar yang berisi daftar frame dan **Exit preview**; klik pada desain atau Escape
menutupnya, dan Escape berikutnya keluar dari Preview.

## Variables: Tokens dan State

Jendela Variables punya dua tab.

- **Tokens** — variable desain (color, number, string, boolean, effect, enum) dengan mode. Tidak berubah. Tipe `array`
  (List) **tidak lagi** ada di sini.
- **State** — nilai saat berjalan, disimpan di `doc.data.state = { variables, derived }`, terpisah dari
  `doc.data.variables`. State **tidak dibagikan lewat library**.

### State variable

`{ id, name, type, initial, scope, description?, options?, itemType?, schema? }`

| Tipe | Nilai | Catatan |
|---|---|---|
| String / Number / Boolean | teks / angka / true-false | |
| Option | salah satu dari `options` | bisa menggerakkan mode komponen (lihat Bind to State) |
| List | array; `itemType` `object` (baris dengan `schema` field) atau `string` / `number` / `boolean` / `date` | dipakai Repeat |
| Object | satu objek dengan `schema` | |
| Date | `YYYY-MM-DD` atau kosong | |
| File | `null` atau `{ name, size, type }` | diisi di Preview |

Field `schema`: `[{ key, type }]`, tipe `string`, `number`, `boolean`, `date`, `color`. **Scope**: `page` (default, mulai lagi
di tiap halaman) atau `app` (bertahan antar halaman). Aturan (tipe, nilai awal, `checkValue`, `cleanState`) ada di
`packages/builder-core/src/state.js`.

### Derived (nilai turunan)

Hanya-baca, dihitung dari State oleh ekspresi JSON terstruktur (`packages/builder-core/src/expr.js`), tanpa `eval` dan tanpa
string kode. Dibangun dari dropdown yang dibaca seperti kalimat: *Number of rows in [Rows of [People] where [status] [is]
[active]]*.

Operasi: `count`, `sum` (field), `filter` (field + pembanding), `length`, `isEmpty`, `equals`, `compare`
(`eq ne gt gte lt lte contains startsWith endsWith`), `and`, `or`, `not`, `var`, `value`. Satu derived boleh membaca derived
lain; lingkaran terdeteksi (*Circular: a → b → a*) dan pesannya muncul di variable itu, yang lain tetap dihitung.

### Bind to State (tab Behavior)

Frame, komponen, dan instance punya section **Bind to State**. Isinya: *This layer* (`Visible when`; untuk komponen juga
`Look`, yaitu **Option state yang menentukan state mode**, nilainya harus nama state seperti `hover`, `disabled`, `error`), lalu
satu kartu per layer di dalamnya (`Text` untuk teks, `Visible when` untuk semua). Data: `node.stateBind =
{ self: { visible, mode }, layers: { [layerId]: { text, visible } } }`; instance memakai milik komponennya bila tidak punya
sendiri. Teks yang terikat menampilkan nilai apa adanya (List: jumlah baris); "visible" memakai kebenaran nilai (teks kosong,
`0`, list kosong = tidak). Variable yang sudah dihapus memunculkan peringatan, bukan diam-diam.

Binding hanya bekerja di **Preview**; kanvas tetap menampilkan isi yang didesain.

### Repeat

Section **Repeat** mengikat sebuah frame ke **List state**. Anak pertama frame adalah template yang digambar sekali per baris;
anak lain tetap sekali. Layer di dalam template membaca field baris: teks (`Text`), warna (`Fill`), `Visible`, atau nomor baris
(`#`). Preview mengikuti nilai List yang sedang berjalan.

### Preview: evaluation context dan panel State

Preview membuat satu `evalCtx` (`packages/builder-core/src/evalctx.js`): nilai State sekarang + nilai derived. Semua binding
membacanya. State **kembali ke nilai awal** saat Preview dibuka, saat **Restart** (R) atau **Reset** di panel State, dan State
ber-scope `page` kembali saat pindah halaman. Tombol **State** (ikon database) membuka panel yang menampilkan semua variable
dengan kontrol per tipe (nilai bisa diubah tangan) dan nilai derived; nilai yang tidak sah ditolak dan kolomnya diberi tanda.
Panel ini untuk memeriksa binding; aksi yang mengubah State menyusul.

## Events, kondisi, aksi, rules (Phase 2)

Semua tetap deklaratif (JSON) dan logikanya fungsi murni di builder-core, jadi Preview dan generator kode nanti membaca data yang
sama. Interaction lama **tidak berubah**: field baru semuanya opsional, jadi `behaviorVersion` tetap `2`.

### Events (trigger)

Selain On click, On hover, On mouse enter, On focus, On blur, On change, On submit:

| Trigger | Kapan |
|---|---|
| On page load | frame ditampilkan (Preview dibuka, Restart, atau pindah ke frame itu). Dipasang pada frame atau layer di dalamnya; frame sekarang punya section **Interaction** juga |
| On search | Enter pada field ber-**Input type = Search** (field lain: On submit) |
| On open / close | layer yang dibuka interaction ini (dropdown / overlay / popover) terbuka atau tertutup |

### Kondisi

Kondisi memakai **ekspresi boolean yang sama dengan derived** (`expr.js`), tanpa evaluator kedua, dibangun dari dropdown:
*If [Attempts] [is at least] [5]*. Sumber nilai:

- State dan derived; list: `count`, `length`, `isEmpty`, `filter`;
- **validitas field**: *Field is valid* / *Field is invalid* (operasi `valid` / `invalid`; dihitung seperti submit, field kosong yang wajib = tidak valid);
- nilai milik Preview (`$`): **Request in progress** (`$loading`), **Last response** (`$response`, nama skenario), **Last response type**
  (`$responseKind`: success / error / empty). Hanya tersedia di kondisi dan template, bukan di derived.

Tempat kondisi: `if` opsional pada **setiap interaction** (di bawah *When*; tidak lolos = tidak ada yang jalan), pada **setiap rule**, dan
**Show when** pada setiap layer di *Bind to State* (`stateBind.self.when`, `stateBind.layers.<id>.when`; melengkapi *Visible when* yang
memakai satu variable). Kondisi yang rusak (variable terhapus, field belum dipilih) tidak diam: Preview menampilkan peringatan
kecil di bawah layar dan kondisi itu dianggap tidak terpenuhi.

### Aksi baru

Aksi yang sudah ada (navigate, overlay, set variable/mode, set selected, change variant) tidak berubah.

| Aksi | Isi |
|---|---|
| **Set State** | `set` (nilai tetap atau variable lain, disesuaikan dengan tipe), `increment` / `decrement` (Number), `toggle` (Boolean), `reset` ke nilai awal |
| **Add / Update / Delete row, Clear** (List) | add: nilai per field (field yang tidak diisi memakai default tipenya); update dan delete: untuk **baris yang cocok** (*Only rows where field …*) atau semua baris |
| **Show feedback** | `kind` alert / message / modal / drawer / popconfirm, `level` success / error / warning / info, title, message, posisi, *Hide after* (ms, 0 = tetap), **blocking**. Modal dan popconfirm punya *When confirmed* (aksi yang jalan saat OK) |
| **Check field** | memeriksa satu field (atau semua field di layar) seperti submit; yang tidak valid masuk state error |
| **Simulated request** | lihat bawah |

Pesan memakai **template**: `{Nama State}` diganti nilainya, huruf besar-kecil tidak berpengaruh, nama yang tidak ditemukan **dibiarkan
apa adanya** (typo kelihatan). Visual feedback bawaan Preview; alert tetap satu jenis dengan `level` sebagai mode-nya (komponen
buatan sendiri untuk feedback datang bersama presets).

### Rules

Sebuah interaction boleh punya **Rules**: daftar berurutan yang masing-masing bernama (mis. *AC-3 Lockout*), punya kondisi dan aksi.
Urutannya: `if` interaction, aksi biasa, lalu rules — **rule pertama yang aktif dan kondisinya terpenuhi menang, sisanya tidak
dilihat**; bila tidak ada, **Otherwise** (opsional) yang jalan. Rule tanpa kondisi selalu cocok. Di tab Behavior: bagian *Rules*
terlipat (jumlahnya di ringkasan), tiap rule satu baris (switch aktif, nama, ringkasan *If … → n actions*), bisa diurutkan, dihapus,
dan dibuka untuk mengedit nama, kondisi, dan aksi. Data: `interaction.rules = { items: [{ id, name, enabled, if?, actions }], otherwise?: { actions } }`.

### Simulated request dan skenario

*Simulated request* menampilkan keadaan loading (garis kemajuan di atas, layar tidak bisa disentuh, `$loading` = true; klik kedua pada
interaction yang sama diabaikan), menunggu `delay` ms, lalu berakhir dengan **skenario aktif**. Aksi setelahnya dan **rules** jalan
sesudah itu, jadi rule bisa memilih berdasarkan **Last response**. Tidak ada panggilan jaringan.

Skenario ditulis per file di tab **State → Scenarios** (`state.scenarios = [{ id, name, kind }]`; bawaan Success / Error / Empty,
tambah mis. *Wrong credentials*, *Account disabled*); `kind` success / error / empty. Toolbar Preview (muncul bila ada Simulated
request) punya **Scenario** (pilihan) dan **Slow** (menunggu 3× lebih lama). Mengganti skenario **tidak mereset State**.

### Validasi

Field di Preview divalidasi lewat satu fungsi, `validateInput` (`packages/builder-core/src/validate.js`, aturan sama dengan form hasil
generate); duplikat di `live.js` sudah dihapus. Perilaku yang sudah ada tidak berubah (wajib kosong tidak salah sebelum disentuh;
sesudah Enter / submit, salah).

### Template teks

Layer teks di *Bind to State* punya pilihan **Text with {placeholders}**: teks layer itu sendiri ditulis dengan nama dalam kurung kurawal
(*Total: Rp {total}*) dan Preview mengisinya. Mengikat ke satu variable tetap mengganti seluruh teks.

## Capabilities, slots, Convention (Phase 3)

### Struktur panel (daftar di inspector, edit di window)

Inspector hanya berisi **daftar ringkas**, seperti tab Design dan panel prototype Figma. Tiap section punya header dengan tombol **+**:
*Interactions*, *Behavior* (ikon gear = Behavior settings), *State mapping*, *Repeat*, *Bind to State* (Repeat dan Bind hanya untuk frame).
Satu item = satu baris: ikon, nama, ringkasan satu baris (*On click · Navigate → Home*, *Can type · Text*), tanda ⚠ bila ada slot wajib
yang belum di-map atau target yang kosong (alasannya ada di window), dan di saat hover toggle enable + tombol hapus. Tidak ada form di
panel; hanya Disabled (instance), Frame role dan Scroll Behavior yang tetap inline.

**+** atau klik baris membuka item di **window mengambang** `#bh-window` (cangkang yang sama dengan window Variables: `.vars-window`,
title bar yang bisa diseret, `wireWindowDrag`). Lebar 320px, di kiri inspector, satu window pada satu waktu, isi menggulung sendiri.
Perubahan berlaku langsung; X atau Esc menutup (Esc tidak ikut membatalkan seleksi), ganti seleksi juga menutup. `BHW` di
`midas.js` menyimpan `{ kind, key, sub }`; `renderInspector()` menggambar ulang window setelah daftar. Isi window per `kind`:

| kind | key | isi |
|---|---|---|
| `interaction` | id interaction | When, If, action + parameter, baris **Rules ›**. Rules dibuka sebagai tampilan dalam window yang sama (`sub: 'rules'`, tombol panah kembali di title bar; Esc kembali dulu, baru menutup) |
| `cap` | id capability | alasan peringatan, saran Convention untuk capability itu (Accept / Accept all), slot, aturan validasi, Advanced |
| `add` | | Add behavior: *Start from* preset, lalu capability per grup. Memilih satu langsung membuka window konfigurasinya |
| `settings` | | **Behavior settings** (level file), tiga tab (`settingsUi.js`): **Slots** dan **States** = tabel satu baris per role / state dengan nama yang diterima sebagai token kecil (3 tampil + "+N", klik token = hapus, "+" = tambah, kotak cari di atas); **Feedback** = satu baris per jenis dengan pemilih komponen dan badge *built-in* bila belum di-map. Footer *Reset … to defaults* hanya mereset tab yang aktif (mapping feedback milikmu tidak ikut hilang saat reset Slots). Dibuka dari ikon gear dan dari *Edit convention…* di dropdown slot |
| `state` | | State mapping (hubungkan collection, mode per state, override) |
| `repeat` / `bind` | | isi section Repeat / Bind to State |

"+" di Interactions langsung menambah interaction (On click → Navigate, seperti Figma) dan membukanya. Interaction tidak punya field
`enabled`, jadi barisnya hanya punya tombol hapus (skema tidak diubah). Instance tanpa interaction sendiri menampilkan interaction
dari main component sebagai baris baca-saja dengan tombol *Edit on this instance*. Kode: `behaviorPanelUi.js` (baris, header, cangkang
window; murni, dites di `behaviorPanel.test.js`), `capabilitiesUi.js` (isi window capability, add, settings).

Label di window punya kolom sendiri (84px); label lebar penuh (`.bh-wide`) ditumpuk di atas kontrolnya. Ini memperbaiki teks yang
saling menimpa pada kartu "Can type" (label tadinya dijepit di kotak 28px).

### Add Behavior

Tab kosong hanya menampilkan baris kosong dan **+**. Window Add behavior: baris *Start from* (preset bernama Ant Design) lalu capability
per grup Input / Action / Data / Feedback; capability yang tidak cocok dengan layer disembunyikan ("N more do not fit").

| Capability | Slots (* = wajib) | Disimpan di |
|---|---|---|
| Can type | value*, placeholder, icon | `inputBehavior.typeable` (`frameId` = slot value, `inputType`) |
| Has validation | tanpa slot | `inputBehavior.validation` (`rules`, `trigger`, `off`) |
| Has options | value*, placeholder, chip, remove | `behaviors[]` di master |
| Shows items | item*, label*, search, empty | `behaviors[]` |
| Opens popup | popup* | `behaviors[]` |
| On click | tanpa slot | interaction `onClick` |
| Has loading | icon | `behaviors[]` |
| Show feedback | message*, title, icon, close, confirm, cancel | `behaviors[]` |

Mapping slot disimpan di **master**; instance hanya menyimpan override (`behaviorOverrides`). Layer instance dicari lewat id →
`sourceId` → nama yang sama. Slot wajib yang belum di-map memberi peringatan terlihat di section dan behavior itu tidak jalan
(Preview menampilkan alasannya, mis. *Select: Value is not set. The popup does not open until it is mapped.*).

**Convention** (`doc.data.convention`, per file): nama slot, nama state, dan komponen untuk tiap jenis feedback. Ini pengaturan
file, bukan properti layer, jadi ada di window **Behavior settings**. Hanya *menyarankan*: window capability menawarkan **Accept**
per slot atau **Accept all**; tidak ada yang di-map sendiri. Skor nama: sama persis > diawali/diakhiri > mengandung sebagai kata; satu layer hanya untuk satu role; value ↔
placeholder boleh berbagi satu layer; satu-satunya layer teks dipakai untuk role teks wajib.

**Preset** (`planPreset`): Trigger (Button, FloatButton), Text entry (Input, TextArea, Password, Search, InputNumber,
AutoComplete), Choice (Select single/multiple, Radio, Checkbox, Switch, Segmented), Feedback (Alert, Message, Notification,
Modal, Drawer, Popconfirm). Event Ant: `onClick`, `onChange`, `onSearch`, `onOpenChange`, `onFinish`, `onFinishFailed`.

**Select + Dropdown**: popup menempel di bawah Select dengan lebar sama, tutup saat klik di luar. Item dirender seperti repeater
dengan state default/hover/selected/disabled. Single: pilih menutup. Multiple: toggle, popup tetap terbuka, chip dengan
tombol remove, placeholder bila kosong. Slot search menyaring berdasarkan label; slot empty tampil bila tak ada hasil.
Validasi Select memakai `validate()` yang sama dan menggerakkan state error-nya.

**Feedback**: *Show feedback* memilih komponen milik user per jenis (Alert/Message/Notification memakai satu komponen dengan
mode `type` success/error/warning/info). Bila belum dipilih: peringatan di section dan Preview memakai tampilan bawaan dengan
badge kecil **built-in**. **Has loading**: bila komponen punya mode `loading` di koleksi `* states`, mode itu dipakai selama
Simulated request lalu dikembalikan; bila tidak ada, klik selama loading diabaikan.

**Validasi**: `validateByRules(rules, value, …)` di `validate.js` (required, type email/url/number/integer, min, max, len,
pattern, message; `validateTrigger` change/blur) dipakai Input, Select, dan kondisi *Field is valid / invalid*.

**Audit lama → slot**: `typeable.frameId` = slot value Can type; `validation.required/trigger` = Has validation (ditambah
`rules`, `off`); `componentTypeOf` hanya jadi petunjuk preset; `stateMapping`/`stateModes` tetap perilaku state (bukan slot),
nama state Convention hanya memperluas pencarian mode. Data lama tidak perlu migrasi.

## Navigation families (Batch C)

Each family is a capability in `capabilities.js` (group Action or Data), its pure rules in `navigation.js`, and a runtime in `live.js`.
Its State is a plain State variable: the preset or the window's "Set up … State" button creates it, and conditions and texts can read it.
Looks come from the `* states` modes. The state names a family uses are the Midas states that already exist.

| Capability | State (config) | Slots | Behavior |
| --- | --- | --- | --- |
| Has tabs | active tab (`state`, option or string) | tab (container, required), label, panel (container, required) | A click on a tab makes it active; its panel shows and the tab is drawn Selected. A disabled tab ignores clicks. Warns and does nothing while unmapped. |
| Has pager | page, pageSize, total (`vars`, numbers) | prev, next, pageLabel, pageItem, pageSize, total | Standalone, or bound to a table's own States. Prev/Next drawn Disabled at the edges; a page item per page with “…” for gaps (selected = current); the page size button goes 10 → 20 → 50 and back to page 1; the page clamps when the total shrinks. |
| Has steps | current step (number, 0 = first), gate (boolean, optional) | step (container, required), prev, next | Steps before the current one are `completed`, the current one `active` (`error` while the gate is false), the rest `upcoming`. Next is refused while the gate is false. |
| Has collapse | open section (string; `mode` accordion or multiple) | section (container, required), panel (container, required) | A click on a section header opens or closes it; accordion keeps one open. An open header is Selected; a closed section hides its panel. |
| Has menu | selected item (string) | item (container, required) | A click selects an item (Selected look); a disabled item ignores clicks. Same runtime as Has tabs, without panels. |
| Has carousel | current slide (number), loop (flag) | slide (container, required), dot, prev, next | One slide shows at a time. Prev/Next and the dots move it; Loop wraps round, else the ends are disabled. The dot of the current slide is Selected. |

Deviations from the first design (kept on purpose, to keep to the existing State types and modes):
- Steps: the step states are `upcoming`, `active`, `completed`, `error` (the names Midas already has), not wait/process/finish.
- Collapse and Menu: the open section and the selected item are a string State (comma-separated for several open sections), not a List State.
- Title, description, icon and connector of a step are not connected: a step shows its own layers. Icon of a collapse section is not connected.
- Pager: the page size is a button that cycles 10 → 20 → 50, not a select; the jump input is not connected.
- Carousel: autoplay is not in Preview yet.
- Menu: sub-menus are not in this family.
- Steps and Collapse: the gate is a boolean State (a condition such as “step form valid” is not connected yet).
- onChange runs on every change; the checks did not include an interaction that reads it.

## Versi data behavior dan migrasi

File punya `behaviorVersion` yang **terpisah** dari `version` (yang tetap `1`; loader menolak nilai lain). Tidak ada = `1`
(List masih token `array`); model ini = `2`.

`migrateBehavior(data)` (`packages/builder-core/src/migrate.js`) murni dan idempoten, dipanggil setiap file dimuat: token
`array` pindah menjadi State List ber-scope `page`, **id dipertahankan** sehingga `repeat.variableId` lama tetap bekerja
(satu daftar per token: dipakai mode pertama yang berisi list). `behaviorVersion` yang lebih baru dari yang dikenal tetap
dibuka: nilainya dipertahankan dan field State yang tidak dikenal dibuang oleh normalizer.

## Change variant dan Smart animate

Action **Change variant** (seperti *Change to* di Figma) memilih, per variant property dari component set layer ini, nilai
tujuannya (`variants: { Property: 'Value' }`; yang dibiarkan *Keep current* tidak berubah). Perubahan dari **On hover / On mouse
enter / On focus** kembali sendiri saat pointer pergi atau fokus hilang; dari **On click** bertahan. Transisinya **Smart
animate** (default, 250 ms), Dissolve, atau Instant: layer yang namanya sama di variant lama dan baru berpindah, berubah ukuran,
dan berganti warna (posisi, ukuran, warna, radius, opacity); layer baru fade in. Nilai variant yang bernama state (`Hover`,
`Pressed`…) sudah dipakai Preview untuk state bawaan, jadi tanpa Smart animate.

## Layout di preview

Preview tidak punya mesin layout sendiri dan tidak lagi meminjam hasil `ctx.layout`: auto layout diterjemahkan ke CSS
flexbox dan browser yang menghitungnya. Satu-satunya tempat pemetaan itu adalah `nodeToStyle(node, parent)` di
`apps/studio/src/preview/flexStyle.js` (fungsi murni, dites di `apps/studio/test/flexStyle.test.js`). `parent` wajib
ada karena Fill hanya bisa ditentukan dari arah parent.

| Midas | CSS |
|---|---|
| `layout` `horizontal` / `vertical` (`layoutFlip`) | `display: flex`, `flex-direction: row` / `column` (`-reverse`) |
| `gap`, `gapCross` | `gap` (atau `column-gap` / `row-gap` bila berbeda) |
| `padding`, `padT/R/B/L` | `padding`, `box-sizing: border-box` |
| `primaryAlign` start / center / end | `justify-content` flex-start / center / flex-end |
| `gapAuto` + `gapMode` between / evenly / around | `justify-content` space-between / space-evenly / space-around |
| `counterAlign` | `align-items` |
| `layoutWrap` | `flex-wrap: wrap` |
| Fixed | `width` / `height` px (`flex-shrink: 0` di sumbu utama) |
| Hug | `auto`; teks yang hug lebarnya `white-space: nowrap` |
| Fill di sumbu utama parent | `flex: 1 1 0` + `min-width: 0` (`min-height: 0` untuk kolom) |
| Fill di sumbu silang | `align-self: stretch`, tanpa ukuran di sumbu itu |
| `layoutPositioning: absolute` | `position: absolute` dengan `left` / `top` = x / y |
| frame tanpa auto layout | `position: relative`, anaknya `position: absolute` di x / y |
| `clip` | `overflow: hidden` |
| `minW` `maxW` `minH` `maxH` | `min-width` dst. |

Root mengikuti mode ukurannya sendiri (Fixed px, Hug `fit-content`, Fill `100%`). Hug hanya berarti pada teks dan frame
auto layout; pada layer lain ia dibaca sebagai Fixed. Yang belum dipetakan: opsi *strokes included* di dalam alur, dan
perataan baseline teks.

## Batasan

- State mapping belum ikut dibangkitkan ke kode aplikasi (generator); sekarang baru berlaku di preview.
- `Close overlay` menutup layer yang dibuka interaction; dialog bawaan Code Builder (konfirmasi hapus)
  tetap memakai mekanismenya sendiri.
- Snapshot library lama yang masih memuat token `array` tidak ikut dimigrasi (State tidak dibagikan lewat library): List itu hilang saat library di-update.

## Overlay yang dibuat Midas

Action Open dropdown / overlay / popover memakai instance overlay di level halaman (`isOverlay`, `overlayTrigger`). Instance yang dibuat Midas diberi `autoCreated: true` dan `ownerId` (id interaction yang memintanya); layer buatan user tidak pernah diberi tanda dan tidak pernah dihapus otomatis. Setelah tiap edit Behavior, overlay bertanda yang tidak diminta interaction mana pun dihapus dalam transaksi yang sama (satu undo); yang masih diminta interaction lain tetap, ownernya pindah. Menghapus trigger atau frame-nya ikut menghapus overlay-nya; saat file dibuka overlay bertanda yang triggernya sudah tidak ada dibuang. Overlay tanpa tanda (file lama) yang tidak dibuka interaction apa pun ditawarkan: *Remove N unused overlay layers* di section Interactions. Di kanvas overlay tersembunyi dan hanya muncul saat window interaction-nya terbuka (atau dipilih), dengan tag *Overlay of …*. Logika murni: `packages/builder-core/src/overlays.js`.
