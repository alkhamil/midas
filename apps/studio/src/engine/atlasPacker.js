// Pengemas texture atlas raster (WebGPU). Fungsi murni tanpa DOM/GPU supaya bisa diuji.
//
// Atlas = `layers` halaman bujur sangkar `size` × `size`. Tiap halaman berisi baris-baris; item masuk ke baris yang
// paling rendah yang masih cukup tinggi (best-fit), baris baru dibuka bila tidak ada. Pengemas lama hanya punya satu
// baris aktif per halaman, setinggi item tertinggi di dalamnya, sehingga ±80% atlas terbuang dan atlas sudah "penuh"
// dengan ±600 teks/path kecil — lalu seluruh isinya dibuang dan diraster ulang di setiap frame.
export class AtlasPacker {
    constructor(size, layers) {
        this.size = size;
        this.layers = layers;
        this.reset();
    }
    reset() {
        this.pages = [{ y: 1, rows: [] }];
    }
    /** Cari tempat untuk item w × h (piksel). Mengembalikan { x, y, page } atau null bila atlas penuh. */
    alloc(w, h) {
        const size = this.size;
        if (w + 2 > size || h + 2 > size)
            return null;
        for (let pi = 0; pi < this.pages.length; pi++) {
            const pg = this.pages[pi];
            let best = null;
            // Baris yang terlalu tinggi (> 2× + 8) tidak dipakai supaya item pendek tidak memboroskan baris tinggi.
            for (const row of pg.rows)
                if (row.h >= h && row.h <= h * 2 + 8 && row.x + w + 2 <= size && (!best || row.h < best.h))
                    best = row;
            if (best) {
                const x = best.x;
                best.x += w + 2;
                return { x, y: best.y, page: pi };
            }
            if (pg.y + h + 2 <= size) {
                const row = { y: pg.y, h, x: 1 + w + 2 };
                pg.rows.push(row);
                pg.y += h + 2;
                return { x: 1, y: row.y, page: pi };
            }
        }
        if (this.pages.length < this.layers) {
            this.pages.push({ y: 1, rows: [] });
            return this.alloc(w, h);
        }
        return null;
    }
}
