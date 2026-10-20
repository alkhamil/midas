#!/usr/bin/env python3
"""Download seluruh icon pack WDS dari Figma sebagai SVG.

Scope (dari canvas node 806:721 di file WDS - Variable):
  5 styles x 1261 ikon = 6305 SVG dalam 37 kategori.

Pemakaian:
  export FIGMA_API_TOKEN="<token>"
  python3 scripts/download-wds-icons.py

Output:
  public/icons/wds/<style>/<kategori>/<ikon>.svg + manifest.json

Hanya memakai stdlib (urllib). File yang sudah ada dilewati (resume aman).
"""

import concurrent.futures
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

FILE_KEY = "ThLaTINM5dmzPW4AsB8dnF"
CANVAS_ID = "806:721"
OUT_ROOT = os.path.join("public", "icons", "wds")
BATCH_SIZE = 150
WORKERS = 12

STYLE_SLUGS = {
    "Bold": "bold",
    "Bold Duotone": "bold-duotone",
    "Broken": "broken",
    "Line Duotone": "line-duotone",
    "Outline": "outline",
}

TOKEN = os.environ.get("FIGMA_API_TOKEN", "")
if not TOKEN:
    sys.exit("FIGMA_API_TOKEN kosong. export FIGMA_API_TOKEN=\"<token>\" dulu.")


def api_get(url):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"X-Figma-Token": TOKEN})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - retry untuk error network/API apa pun
            wait = 2**attempt
            print(f"  retry API ({attempt + 1}/5) setelah {wait}s: {e}", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"API gagal setelah 5x coba: {url}")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.strip().lower()).strip("-") or "unnamed"


def fetch_url(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "wds-icons/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
            if not body.lstrip().startswith(b"<svg"):
                raise ValueError("respons bukan SVG")
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:
                f.write(body)
            return True
        except Exception as e:  # noqa: BLE001
            time.sleep(1 + attempt)
            if attempt == 3:
                print(f"  GAGAL {dest}: {e}", flush=True)
    return False


def main():
    print("1/3 mengambil struktur canvas dari Figma ...", flush=True)
    data = api_get(
        f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={CANVAS_ID}"
    )
    doc = data["nodes"][CANVAS_ID]["document"]

    items = []

    def walk(n):
        if n.get("type") == "COMPONENT":
            parts = [p.strip() for p in n.get("name", "").split("/")]
            if len(parts) == 3 and parts[0] in STYLE_SLUGS:
                items.append(
                    {"id": n["id"], "style": parts[0],
                     "category": parts[1], "icon": parts[2]}
                )
        for c in n.get("children") or []:
            walk(c)

    walk(doc)
    print(f"   komponen ditemukan: {len(items)}", flush=True)

    seen = {}
    for it in items:
        base = "/".join([OUT_ROOT, STYLE_SLUGS[it["style"]],
                         slug(it["category"]), slug(it["icon"])])
        key = base
        if key in seen:  # nama kembar -> suffix node id
            key = f"{base}--{it['id'].replace(':', '-')}"
        seen[key] = it
        it["file"] = key + ".svg"

    print("2/3 meminta URL export SVG ...", flush=True)
    ids = [it["id"] for it in items]
    url_map = {}
    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i : i + BATCH_SIZE]
        params = urllib.parse.urlencode({"ids": ",".join(batch), "format": "svg"})
        res = api_get(f"https://api.figma.com/v1/images/{FILE_KEY}?{params}")
        url_map.update(res.get("images", {}))
        print(f"   {i + len(batch)}/{len(ids)}", flush=True)
        time.sleep(0.3)

    missing = [i for i in ids if not url_map.get(i)]
    print(f"   URL didapat: {len(ids) - len(missing)}/{len(ids)}", flush=True)
    for m in missing[:20]:
        print(f"   tanpa URL: {m}", flush=True)

    print("3/3 mengunduh SVG ...", flush=True)
    jobs = [(url_map[it["id"]], it["file"]) for it in items if url_map.get(it["id"])]
    ok = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = {pool.submit(fetch_url, u, d): d for u, d in jobs}
        for n, fut in enumerate(concurrent.futures.as_completed(futs), 1):
            if fut.result():
                ok += 1
            if n % 500 == 0:
                print(f"   terunduh {n}/{len(jobs)} (ok {ok})", flush=True)

    manifest = [
        {"id": it["id"], "style": it["style"], "category": it["category"],
         "icon": it["icon"], "file": it["file"]}
        for it in items
    ]
    os.makedirs(OUT_ROOT, exist_ok=True)
    with open(os.path.join(OUT_ROOT, "manifest.json"), "w") as f:
        json.dump({"source": {"fileKey": FILE_KEY, "nodeId": CANVAS_ID},
                   "count": len(manifest), "icons": manifest}, f, indent=1)
    print(f"SELESAI: {ok}/{len(jobs)} file OK -> {OUT_ROOT}/", flush=True)


main()
