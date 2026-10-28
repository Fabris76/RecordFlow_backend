const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidPhone, isStrongPassword } = require('../src/controllers/vendorController');

test('accepts valid Ghanaian-style vendor phone numbers', () => {
  assert.equal(isValidPhone('0240000000'), true);
  assert.equal(isValidPhone('0201234567'), true);
  assert.equal(isValidPhone('1234567890'), false);
  assert.equal(isValidPhone('abc'), false);
});

test('requires a strong vendor password', () => {
  assert.equal(isStrongPassword('Vendor@123'), true);
  assert.equal(isStrongPassword('vendor123'), false);
  assert.equal(isStrongPassword('short'), false);
});
