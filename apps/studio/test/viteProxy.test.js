// The dev proxy answers 503 with a reason while the API is not listening (it used to answer a bare 500).
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiProxyError } from '../vite.config.js';

function fakeRes() {
    return { headersSent: false, writableEnded: false, status: 0, headers: {}, body: '', writeHead(code, h) { this.status = code; this.headers = h; }, end(b) { this.body = b; this.writableEnded = true; } };
}

test('a refused connection to the API is a 503 with a readable message and retry-after', () => {
    const res = fakeRes();
    apiProxyError(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:4000'), { code: 'ECONNREFUSED' }), {}, res);
    assert.equal(res.status, 503);
    assert.equal(res.headers['retry-after'], '2');
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'api_unavailable');
    assert.equal(body.code, 'ECONNREFUSED');
    assert.match(body.message, /not running yet/);
});

test('a response that already started is left alone', () => {
    const res = fakeRes(); res.headersSent = true;
    apiProxyError(new Error('x'), {}, res);
    assert.equal(res.status, 0);
});
