const fs = require('fs');
const backupModel = require('../models/backupModel');
const auditModel = require('../models/auditModel');
const backupService = require('../services/backupService');
const db = require('../config/database');

const parseId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const validatePagination = ({ page, limit }) => {
    if (page !== undefined && (!Number.isInteger(Number(page)) || Number(page) < 1)) return 'Page must be a positive integer';
    if (limit !== undefined && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) return 'Limit must be a positive integer not greater than 100';
    return null;
};

const createBackup = async (req, res) => {
    try {
        const backup = await backupService.createRecordedBackup(req.user.id);
        return res.status(201).json({
            success: true,
            message: 'Database backup created successfully',
            data: { filename: backup.filename, size: backup.fileSize, created_at: new Date() }
        });
    } catch (error) {
        console.error('Create backup error:', error.message);
        return res.status(500).json({ success: false, message: 'Database backup failed' });
    }
};

const listBackups = async (req, res) => {
    const paginationError = validatePagination(req.query);
    if (paginationError) return res.status(400).json({ success: false, message: paginationError });
    try {
        const result = await backupModel.list(req.query);
        return res.status(200).json({ success: true, data: result.rows, pagination: result.pagination });
    } catch (error) {
        console.error('List backups error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const downloadBackup = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Backup ID must be a valid positive integer' });
    try {
        const backup = await backupModel.getById(id);
        if (!backup || backup.status !== 'COMPLETED') return res.status(404).json({ success: false, message: 'Backup not found' });
        const filePath = backupService.resolveBackupPath(backup.filename);
        try { await fs.promises.access(filePath, fs.constants.R_OK); } catch { return res.status(404).json({ success: false, message: 'Backup file is unavailable' }); }
        return res.download(filePath, backup.filename);
    } catch (error) {
        console.error('Download backup error:', error.message);
        return res.status(404).json({ success: false, message: 'Backup file is unavailable' });
    }
};

const restoreBackup = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Backup ID must be a valid positive integer' });
    if (req.body?.confirmation !== 'RESTORE_DATABASE') return res.status(400).json({ success: false, message: 'Restore confirmation is required' });

    let backup;
    try {
        backup = await backupModel.getById(id);
        if (!backup || backup.status !== 'COMPLETED') return res.status(404).json({ success: false, message: 'Backup not found' });
        const backupPath = backupService.resolveBackupPath(backup.filename);
        await fs.promises.access(backupPath, fs.constants.R_OK);
        const backupStats = await fs.promises.stat(backupPath);
        if (!backupStats.isFile() || backupStats.size <= 0) {
            return res.status(404).json({ success: false, message: 'Backup file is unavailable' });
        }

        const safety = await backupService.createRecordedBackup(req.user.id, {
            description: 'Pre-restore safety backup created'
        });
        const startConn = await db.getConnection();
        try {
            await auditModel.create(startConn, { userId: req.user.id, action: 'BACKUP_RESTORE_STARTED', entityType: 'BACKUP', entityId: id, description: 'Database restore started', metadata: { safety_backup_id: safety.id } });
        } finally { startConn.release(); }

        await backupService.restoreDatabase(backupPath);
        if (!await backupService.validateRestoredDatabase()) throw new Error('Restored database is missing required tables');

        const conn = await db.getConnection();
        try {
            await auditModel.create(conn, { userId: req.user.id, action: 'BACKUP_RESTORE_SUCCESS', entityType: 'BACKUP', entityId: id, description: 'Database restore completed', metadata: { safety_backup_id: safety.id } });
        } finally { conn.release(); }
        return res.status(200).json({ success: true, message: 'Database restored successfully', data: { backup_id: id, safety_backup_id: safety.id } });
    } catch (error) {
        console.error('Restore backup error:', error.message);
        try {
            const conn = await db.getConnection();
            try {
                await auditModel.create(conn, { userId: req.user.id, action: 'BACKUP_RESTORE_FAILED', entityType: 'BACKUP', entityId: id, description: 'Database restore failed' });
            } finally {
                conn.release();
            }
        } catch (auditError) { console.error('Restore failure audit error:', auditError.message); }
        if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Backup file is unavailable' });
        return res.status(500).json({ success: false, message: 'Database restore failed' });
    }
};

module.exports = { parseId, validatePagination, createBackup, listBackups, downloadBackup, restoreBackup };