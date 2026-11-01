import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { db, sql } from './index.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const journal = JSON.parse(readFileSync(new URL('../../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { tag: string; when: number }[] };

/** Apply every pending migration in apps/server/drizzle. */
export async function runMigrations(): Promise<void> {
    await migrate(db, { migrationsFolder });
}

/**
 * The migrations in apps/server/drizzle the database has not applied: the journal's entries newer than the last one recorded (the same rule
 * the migrator uses). A database with no migration record has all of them pending.
 */
export async function pendingMigrations(): Promise<string[]> {
    const [table] = await sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`;
    if (!table.present) return journal.entries.map(entry => entry.tag);
    const [last] = await sql`select max(created_at) as last from drizzle.__drizzle_migrations`;
    const applied = Number(last.last ?? 0);
    return journal.entries.filter(entry => entry.when > applied).map(entry => entry.tag);
}
