import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { db, sql } from './index.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
await migrate(db, { migrationsFolder });
console.log('Migrations applied');
await sql.end();
