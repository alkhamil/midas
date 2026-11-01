import { buildApp } from './app.js';
import { config } from './config.js';
import { pendingMigrations, runMigrations } from './db/migrations.js';
import { seedAdmin } from './db/seed.js';
import { ensureBucket } from './lib/s3.js';

if (config.autoMigrate) await runMigrations();
// Refuse to start on a database that is behind the code: a request would fail later with an internal error.
const pending = await pendingMigrations();
if (pending.length) throw new Error(`The database is missing ${pending.length} migration(s): ${pending.join(', ')}. Run "npm run db:migrate" in apps/server (or set AUTO_MIGRATE=true), then start the server again.`);
await seedAdmin();
await ensureBucket();
const app = await buildApp();
await app.listen({ port: config.port, host: config.host });
