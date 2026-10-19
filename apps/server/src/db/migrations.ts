import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { db } from './index.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Apply every pending migration in apps/server/drizzle. */
export async function runMigrations(): Promise<void> {
    await migrate(db, { migrationsFolder });
}
