const test = require('node:test');
const assert = require('node:assert/strict');

const notificationService = require('../src/services/notificationService');
const notificationController = require('../src/controllers/notificationController');

test('notification types are controlled and normalized', () => {
    assert.equal(notificationService.normalizeType('large_transaction'), 'LARGE_TRANSACTION');
    assert.equal(notificationService.isValidType('UNUSUAL_ACTIVITY'), true);
    assert.equal(notificationService.isValidType('BRANCH_CREATED'), false);
});

test('large transaction threshold uses configuration and a safe default', () => {
    const previous = process.env.LARGE_TRANSACTION_THRESHOLD;

    process.env.LARGE_TRANSACTION_THRESHOLD = '7500';
    assert.equal(notificationService.getLargeTransactionThreshold(), 7500);

    process.env.LARGE_TRANSACTION_THRESHOLD = 'invalid';
    assert.equal(notificationService.getLargeTransactionThreshold(), 5000);

    if (previous === undefined) delete process.env.LARGE_TRANSACTION_THRESHOLD;
    else process.env.LARGE_TRANSACTION_THRESHOLD = previous;
});

test('notification query helpers validate read state, dates, and pagination', () => {
    assert.equal(notificationController.parseIsRead('true'), true);
    assert.equal(notificationController.parseIsRead('false'), false);
    assert.equal(notificationController.parseIsRead('yes'), null);
    assert.equal(notificationController.isValidDateString('2026-09-06'), true);
    assert.equal(notificationController.isValidDateString('2026-02-30'), false);
    assert.equal(notificationController.validatePagination({ page: '1', limit: '100' }), null);
    assert.equal(notificationController.validatePagination({ page: '0' }), 'Page must be a positive integer');
    assert.equal(notificationController.validatePagination({ limit: '101' }), 'Limit must be a positive integer not greater than 100');
});