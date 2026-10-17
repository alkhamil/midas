import { buildApp } from './app.js';
import { config } from './config.js';
import { ensureBucket } from './lib/s3.js';

await ensureBucket();
const app = await buildApp();
await app.listen({ port: config.port, host: '127.0.0.1' });
