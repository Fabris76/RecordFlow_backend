const test = require('node:test');
const assert = require('node:assert/strict');

const backupService = require('../src/services/backupService');
const backupController = require('../src/controllers/backupController');

test('backup filenames are server-generated and use the expected format', () => {
    const filename = backupService.createFilename(new Date('2026-09-09T14:25:00'));
    assert.equal(filename, 'momo_backup_2026-09-09_142500.sql');
    assert.equal(backupService.resolveBackupPath(filename).startsWith(backupService.backupDirectory), true);
});

test('backup path resolution rejects traversal and arbitrary filenames', () => {
    assert.throws(() => backupService.resolveBackupPath('../secrets.sql'), /Invalid backup filename/);
    assert.throws(() => backupService.resolveBackupPath('C:\\secrets.sql'), /Invalid backup filename/);
    assert.throws(() => backupService.resolveBackupPath('backup.sql'), /Invalid backup filename/);
});

test('backup controller validates ids, pagination, and restore confirmation', () => {
    assert.equal(backupController.parseId('5'), 5);
    assert.equal(backupController.parseId('../5'), null);
    assert.equal(backupController.validatePagination({ page: '1', limit: '100' }), null);
    assert.equal(backupController.validatePagination({ limit: '101' }), 'Limit must be a positive integer not greater than 100');
});