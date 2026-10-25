// A 5xx is answered with a JSON body that hides the message (the message goes to the log, which names the route); a 4xx keeps its status.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { buildApp } from '../src/app.js';

test('an unhandled error is a 500 with a JSON body and a logged route', async () => {
    const app = await buildApp();
    app.get('/api/test-boom', async () => { throw new Error('kaboom'); });
    const res = await app.inject({ method: 'GET', url: '/api/test-boom?x=1' });
    assert.equal(res.statusCode, 500);
    assert.equal(res.json().error, 'internal');
    assert.doesNotMatch(res.body, /kaboom/);                       // the message stays in the log, not in the response
    await app.close();
});

test('a 4xx keeps its status and message', async () => {
    const app = Fastify();
    app.get('/x', async () => { throw Object.assign(new Error('nope'), { statusCode: 404, code: 'missing' }); });
    app.setErrorHandler((err, req, reply) => reply.code(err.statusCode ?? 500).send({ error: err.code || 'error', message: err.message }));
    const res = await app.inject({ method: 'GET', url: '/x' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, 'missing');
});
