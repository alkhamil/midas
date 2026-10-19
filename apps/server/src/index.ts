import { buildApp } from './app.js';
import { config } from './config.js';
import { runMigrations } from './db/migrations.js';
import { ensureBucket } from './lib/s3.js';

if (config.autoMigrate) await runMigrations();
await ensureBucket();
const app = await buildApp();
await app.listen({ port: config.port, host: config.host });
