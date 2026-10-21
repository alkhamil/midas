# MCP: Midas untuk asisten AI

Midas punya server **MCP** (Model Context Protocol) di `POST /mcp` (Streamable HTTP, tanpa sesi). Asisten AI seperti Claude atau Cursor bisa **membaca** desain Anda: daftar file, struktur layer, komponen, dan variabel. Tidak ada yang bisa diubah lewat MCP.

## Akses

- Setiap user membuat **token API pribadi**: avatar/workspace → **API access (MCP)** → **Create**. Token (`mdt_…`) tampil **sekali**; yang disimpan server hanya hash-nya.
- Asisten bertindak **sebagai pemilik token**: ia hanya melihat file yang boleh dibuka user itu (role dan cakupan akses berlaku). Token berhenti bekerja saat dicabut (**Revoke**) atau user dimatikan.
- Tanpa token yang sah, `/mcp` menjawab 401.

## Menyambungkan

Claude Code:

```bash
claude mcp add --transport http midas https://<alamat-midas>/mcp --header "Authorization: Bearer mdt_xxx"
```

Klien lain (JSON):

```json
{ "mcpServers": { "midas": { "type": "http", "url": "https://<alamat-midas>/mcp", "headers": { "Authorization": "Bearer mdt_xxx" } } } }
```

Di pengembangan lokal alamatnya `http://127.0.0.1:4000/mcp` (atau lewat Studio di `:5173` yang mem-proxy `/mcp`).

## Tools (semua read-only)

| Tool | Fungsi |
|---|---|
| `list_files` | Daftar file yang boleh dibuka (filter nama) |
| `list_folders` | Folder yang boleh dibuka |
| `get_file` | Halaman file beserta frame tingkat atasnya, dan ringkasan variabel |
| `get_page` | Pohon layer satu halaman (atau satu layer); dipotong bila besar (`depth`, `max_layers`, `layer_id`) |
| `get_layer` | Semua properti satu layer, path-nya, dan anak langsungnya |
| `find_layers` | Cari layer menurut nama atau isi teks |
| `list_components` | Component set (dengan properti variant) dan komponen tunggal |
| `get_variables` | Koleksi variabel, mode, dan nilainya per mode |

Jawaban dibatasi ±90 ribu karakter; bila terpotong, persempit dengan `layer_id`, `depth`, `limit`, atau `query`.
