// One-off: rewrites stored pages without the layer fields that hold the editor's defaults (see lib/compact.ts), so big files
// load faster. Same content for the editor; page versions are not bumped. Safe to run again.
import { and, eq } from 'drizzle-orm';
import { db, sql } from './index.js';
import { designFilePages } from './schema.js';
import { compactPage } from '../lib/compact.js';

const ids = await db.select({ fileId: designFilePages.fileId, pageId: designFilePages.pageId }).from(designFilePages);
let before = 0, after = 0, changed = 0;
for (const { fileId, pageId } of ids) {
    const [row] = await db.select({ data: designFilePages.data }).from(designFilePages).where(and(eq(designFilePages.fileId, fileId), eq(designFilePages.pageId, pageId))).limit(1);
    if (!row) continue;
    const a = JSON.stringify(row.data), next = compactPage(row.data as object), b = JSON.stringify(next);
    before += a.length;
    after += Math.min(a.length, b.length);
    if (b.length < a.length) {
        await db.update(designFilePages).set({ data: next }).where(and(eq(designFilePages.fileId, fileId), eq(designFilePages.pageId, pageId)));
        changed++;
    }
}
console.log(`${changed} of ${ids.length} pages compacted: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB`);
await sql.end();
