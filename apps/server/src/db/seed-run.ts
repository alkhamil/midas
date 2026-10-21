import { sql } from './index.js';
import { seedAdmin } from './seed.js';

await seedAdmin();
console.log('Seed done');
await sql.end();
