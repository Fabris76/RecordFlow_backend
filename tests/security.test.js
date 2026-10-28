const test = require('node:test');
const assert = require('node:assert/strict');

const requestContext = require('../src/middleware/requestContext');
const { createRateLimiter } = require('../src/middleware/rateLimit');

test('request context preserves safe request ids and generates invalid ones', () => {
    const responseHeaders = {};
    const req = { get: () => 'request-123' };
    const res = { setHeader: (name, value) => { responseHeaders[name] = value; } };
    requestContext(req, res, () => {});
    assert.equal(req.requestId, 'request-123');
    assert.equal(responseHeaders['X-Request-ID'], 'request-123');

    const invalidRequest = { get: () => 'bad id' };
    requestContext(invalidRequest, res, () => {});
    assert.match(invalidRequest.requestId, /^[0-9a-f-]{36}$/);
});

test('rate limiter returns 429 after the configured limit', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const request = { ip: '127.0.0.1', baseUrl: '/test', path: '/' };
    let nextCalls = 0;
    const response = { status: () => response, json: (body) => { response.body = body; return response; }, setHeader: () => {} };
    limiter(request, response, () => { nextCalls += 1; });
    limiter(request, response, () => { nextCalls += 1; });
    assert.equal(nextCalls, 1);
    assert.deepEqual(response.body, { success: false, message: 'Too many requests' });
});