const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidAmount, normalizeType, getBalanceEffect } = require('../src/controllers/transactionController');

const VALID_TYPES = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'AIRTIME', 'DATA', 'BILL_PAYMENT', 'OTHER'];

test('validates positive amounts with two decimal places', () => {
  assert.equal(isValidAmount(500), true);
  assert.equal(isValidAmount('500.00'), true);
  assert.equal(isValidAmount(0), false);
  assert.equal(isValidAmount(-10), false);
  assert.equal(isValidAmount(null), false);
  assert.equal(isValidAmount(''), false);
  assert.equal(isValidAmount('abc'), false);
  assert.equal(isValidAmount('500.005'), false);
  assert.equal(isValidAmount(1.001), false);
  assert.equal(isValidAmount(1.01), true);
  assert.equal(isValidAmount(Infinity), false);
  assert.equal(isValidAmount('1e3'), false);
  assert.equal(isValidAmount('1000000001'), false);
});

test('normalizes allowed transaction types', () => {
  assert.equal(normalizeType('deposit'), 'DEPOSIT');
  assert.equal(normalizeType('AIRTIME'), 'AIRTIME');
  assert.equal(normalizeType(' '), '');
  assert.equal(VALID_TYPES.includes(normalizeType('OTHER')), true);
});

test('applies the confirmed balance effect for every transaction type', () => {
  assert.deepEqual(getBalanceEffect('DEPOSIT', 100), { cash: 100, momo: -100 });
  assert.deepEqual(getBalanceEffect('WITHDRAWAL', 100), { cash: -100, momo: 100 });
  assert.deepEqual(getBalanceEffect('TRANSFER', 100), { cash: 0, momo: -100 });
  assert.deepEqual(getBalanceEffect('AIRTIME', 100), { cash: 0, momo: -100 });
  assert.deepEqual(getBalanceEffect('DATA', 100), { cash: 0, momo: -100 });
  assert.deepEqual(getBalanceEffect('BILL_PAYMENT', 100), { cash: 0, momo: -100 });
  assert.deepEqual(getBalanceEffect('OTHER', 100), { cash: 0, momo: 0 });
});
