const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');

const request = (server, { method = 'GET', path, body, headers = {} }) => new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({
        host: '127.0.0.1',
        port: server.address().port,
        method,
        path,
        headers: {
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
            ...headers
        }
    }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
});

test('HTTP smoke tests cover health, auth rejection, request IDs, and safe errors', async (t) => {
    const server = app.listen(0);
    t.after(() => server.close());

    const health = await request(server, { path: '/health', headers: { 'X-Request-ID': 'smoke-123' } });
    assert.equal(health.statusCode, 200);
    assert.equal(health.headers['x-request-id'], 'smoke-123');
    assert.match(health.body, /Server is running/);

    const protectedResponse = await request(server, { path: '/api/analytics/dashboard' });
    assert.equal(protectedResponse.statusCode, 401);
    assert.match(protectedResponse.body, /Authentication required/);
    assert.match(protectedResponse.headers['x-request-id'], /^[0-9a-f-]{36}$/);

    const notFound = await request(server, { path: '/not-a-real-route' });
    assert.equal(notFound.statusCode, 404);
    assert.match(notFound.body, /Route not found/);
});
