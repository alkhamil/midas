// Minimal ustar writer + gzip: enough for an npm tarball (every file lives under `package/`).
import { gzipSync } from 'node:zlib';

const BLOCK = 512;

function octal(n: number, width: number): string {
    return n.toString(8).padStart(width - 1, '0') + '\0';
}

function header(path: string, size: number, mtime: number): Buffer {
    let name = path, prefix = '';
    if (Buffer.byteLength(name) > 100) {
        // Split at a "/" so that the prefix fits 155 bytes and the name 100 bytes.
        const cut = path.split('/').reduce<number>((best, _, i, parts) => {
            const p = parts.slice(0, i).join('/'), n = parts.slice(i).join('/');
            return i > 0 && Buffer.byteLength(p) <= 155 && Buffer.byteLength(n) <= 100 && best < 0 ? i : best;
        }, -1);
        if (cut < 0)
            throw new Error(`path too long for a tar entry: ${path}`);
        const parts = path.split('/');
        prefix = parts.slice(0, cut).join('/');
        name = parts.slice(cut).join('/');
    }
    const h = Buffer.alloc(BLOCK);
    h.write(name, 0, 100, 'utf8');
    h.write(octal(0o644, 8), 100, 8, 'ascii');
    h.write(octal(0, 8), 108, 8, 'ascii');
    h.write(octal(0, 8), 116, 8, 'ascii');
    h.write(octal(size, 12), 124, 12, 'ascii');
    h.write(octal(mtime, 12), 136, 12, 'ascii');
    h.fill(0x20, 148, 156); // checksum field counts as spaces
    h.write('0', 156, 1, 'ascii'); // regular file
    h.write('ustar\0', 257, 6, 'ascii');
    h.write('00', 263, 2, 'ascii');
    h.write(prefix, 345, 155, 'utf8');
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    return h;
}

/** .tgz of `files` (path → content), each stored as `package/<path>`. Deterministic: fixed mtime, sorted paths. */
export function packageTarball(files: Record<string, string | Buffer>, mtime = 0): Buffer {
    const parts: Buffer[] = [];
    for (const path of Object.keys(files).sort()) {
        const data = typeof files[path] === 'string' ? Buffer.from(files[path] as string, 'utf8') : (files[path] as Buffer);
        parts.push(header(`package/${path}`, data.length, mtime), data);
        const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
        if (pad) parts.push(Buffer.alloc(pad));
    }
    parts.push(Buffer.alloc(BLOCK * 2));
    return gzipSync(Buffer.concat(parts), { level: 9 });
}
