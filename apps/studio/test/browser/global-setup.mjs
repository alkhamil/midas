// The suite's global setup (node --test --test-global-setup): the API and the studio start once before the first file and stop once after the last, so no
// test file pays for a server start. The studio is the production build behind `vite preview` unless MIDAS_STUDIO=dev (see run.mjs --dev).
import { STUDIO_MODE, buildStudio, ensureDevServers, stopServers } from './harness.mjs';

export async function globalSetup() {
    if (STUDIO_MODE === 'preview' && process.env.MIDAS_SKIP_BUILD !== '1') buildStudio();
    await ensureDevServers();
}

export async function globalTeardown() {
    await stopServers();
}
