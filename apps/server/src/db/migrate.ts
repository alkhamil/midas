import { sql } from './index.js';
import { runMigrations } from './migrations.js';

await runMigrations();
console.log('Migrations applied');
await sql.end();
