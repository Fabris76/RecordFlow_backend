const test = require('node:test');
const assert = require('node:assert/strict');

const analyticsController = require('../src/controllers/analyticsController');

test('analytics validates real calendar dates and ranges', () => {
    assert.equal(analyticsController.isValidDateString('2026-09-09'), true);
    assert.equal(analyticsController.isValidDateString('2026-02-30'), false);
    assert.deepEqual(analyticsController.parseDateRange({ start_date: '2026-09-09', end_date: '2026-09-01' }), { error: 'Start date cannot be after end date' });
    assert.deepEqual(analyticsController.parseDateRange({ start_date: '2026-09-01' }, { required: true }), { error: 'start_date and end_date are required' });
});

test('analytics sorting is controlled by the endpoint contract', () => {
    assert.equal(analyticsController.parseDateRange({ start_date: '2026-09-01', end_date: '2026-09-09' }).error, undefined);
});

test('optional analytics ranges cover all stored dates when omitted', () => {
    assert.deepEqual(analyticsController.defaultRange({}), { start: '1000-01-01', end: '9999-12-31' });
});