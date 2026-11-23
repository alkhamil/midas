# Prototype: Midas dibandingkan dengan Figma

Dicatat 2026-11-24. Sumber Figma (halaman Help Center, dibaca langsung):
- Triggers: https://help.figma.com/hc/en-us/articles/360040035834
- Actions: https://help.figma.com/hc/en-us/articles/360040035874-Prototype-actions
- Multiple actions and conditionals: https://help.figma.com/hc/en-us/articles/15253220891799-Multiple-actions-and-conditionals
- Animations: https://help.figma.com/hc/en-us/articles/360040522373-Prototype-animations
- Overlays: https://help.figma.com/hc/en-us/articles/360039818254-Create-overlays-in-your-prototypes
- Smart animate: https://help.figma.com/hc/en-us/articles/360039818874-Smart-animate-layers-between-frames

Keadaan Midas: `docs/prototype-spec.md` dan kode di `packages/builder-core/src/prototype/`.

Legenda: ✅ ada, 🟡 sebagian, ❌ belum.

## Trigger

| Figma | Midas | Catatan |
|---|---|---|
| On click / On tap | ✅ `on-click` | |
| On drag (kiri, kanan, atas, bawah) | ❌ | |
| While hovering | ✅ `while-hovering` | |
| While pressing | ✅ `while-pressing` | |
| Keyboard / Gamepad | ❌ | |
| Mouse enter / leave | ✅ `mouse-enter`, `mouse-leave` | |
| Mouse down / up | ✅ `mouse-down`, `mouse-up` | |
| After delay | ✅ `after-delay` | |
| When video hits / ends | ❌ | Midas belum punya video fill sebagai layer interaktif |

## Action

| Figma | Midas | Catatan |
|---|---|---|
| Navigate to | ✅ | |
| Back | ✅ | |
| Open link | ✅ `open-link` | Nama Figma "Open link" sama |
| Open overlay | ✅ | Center, below, above; close on outside click; instant atau dissolve |
| Close overlay | ✅ | |
| Swap overlay | ❌ | |
| Scroll to | ❌ | Scroll behaviour frame ada, tapi aksi "scroll to" belum |
| Set variable | ✅ | Hanya untuk sesi Play (decision 17). Figma menulis variabel di prototype juga |
| Set variable mode | ❌ | |
| Conditional (if / else) | 🟡 | Satu perbandingan per cabang. Tidak ada AND dan OR. Figma: ekspresi boolean |
| Play, pause, mute, seek video | ❌ | |
| Change to (ganti variant komponen) | ❌ | |
| Banyak aksi per trigger, berurutan | ✅ | Interaksi punya daftar `actions` (decision 18, versi 2). Urutan diubah dengan Up dan Down; belum drag |

## Transisi

| Figma | Midas | Catatan |
|---|---|---|
| Instant | ✅ | |
| Dissolve | ✅ | Navigasi dan overlay (overlay: 200 ms tetap, belum bisa diatur) |
| Smart animate | ❌ | |
| Move in / Move out | ❌ | |
| Push | ✅ | |
| Slide in | ✅ | |
| Slide out | ❌ | |
| Easing dan direction | 🟡 | Easing dan arah ada di model; overlay belum bisa diatur |

## Overlay

| Figma | Midas | Catatan |
|---|---|---|
| Tujuh posisi default atau posisi manual | 🟡 | Tiga posisi: center, below, above |
| Close when clicking outside | ✅ | |
| Background di belakang overlay | ❌ | |
| Swap overlay menjaga posisi | ❌ | Swap belum ada |

## Yang Midas punya lebih

- Validasi prototype: `validatePrototype` menolak data yang rusak, dengan kode dan lokasi. Figma tidak menampilkan validasi semacam ini di panel.
- Play sebagai DOM: frame dan komponen digambar sebagai elemen DOM nyata, dengan state `:hover`, `:focus`, dan `:disabled` yang hidup. Dicek terhadap canvas dengan browser test.
- Keputusan yang tercatat: `docs/prototype-spec.md` decision 1 sampai 17.

## Urutan yang paling berguna berikutnya

1. Conditional dengan AND dan OR.
2. Scroll to, Swap overlay, dan posisi overlay yang lengkap.
3. Smart animate, Move in dan out, Slide out.
4. Drag untuk mengurutkan aksi (Figma punya drag, Midas baru Up dan Down).
5. Set variable mode, video, dan Change to: butuh fitur lain di luar prototype (variable mode per halaman, video fill interaktif, dan variant komponen).
