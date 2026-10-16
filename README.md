# Midas (React + Vite)

Design editor ported from the single-file `midas.html` into a React/Vite project.
All work is saved directly to the browser's `localStorage` — no backend server required.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

Production preview:

```bash
npm run build
npm run preview
```

## Storage

All documents and preferences are stored directly in browser `localStorage`:

| Key Prefix | Contents |
| --- | --- |
| `midas:kv:file:<id>` | Design document per file (JSON, same format as exported `.midas`) |
| `midas:kv:index` | File library: names, dates, trash state, thumbnails |
| `midas:kv:last` | ID of the last opened file |
| `midas-options`, `midas-sidebars`, etc. | Editor preferences, plugin storage, sidebar widths |

## Structure

- `index.html` – page head, vendor scripts, React root
- `src/App.jsx`, `src/components/Shell.jsx` – React shell (top bar, panels, canvas, overlays)
- `src/engine/midas.js` – the editor engine (renderer, document model, tools); starts once after the shell mounts
- `src/storage.js` – storage adapter using browser `localStorage`
- `public/vendor/` – fflate/kiwi/fzstd (Figma import) and polygon-clipping
- `midas.html` – original single-file version, kept for reference
# midas
