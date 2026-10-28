const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const db = require('../config/database');
const backupModel = require('../models/backupModel');
const auditModel = require('../models/auditModel');

const backupDirectory = path.resolve(__dirname, '../../storage/backups');
const safeFilenamePattern = /^momo_backup_\d{4}-\d{2}-\d{2}_\d{6}(?:_\d+)?\.sql$/;
const requiredTables = [
    'users', 'vendors', 'transactions', 'transaction_history', 'daily_closing',
    'vendor_balances', 'balance_history', 'audit_logs', 'notifications', 'backups'
];

const getExecutable = (environmentVariable, fallback) => process.env[environmentVariable] || fallback;

const ensureBackupDirectory = async () => {
    await fs.promises.mkdir(backupDirectory, { recursive: true });
};

const createFilename = (date = new Date()) => {
    const pad = (value) => String(value).padStart(2, '0');
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `momo_backup_${stamp}.sql`;
};

const resolveBackupPath = (filename) => {
    if (typeof filename !== 'string' || !safeFilenamePattern.test(filename)) {
        throw new Error('Invalid backup filename');
    }
    const resolved = path.resolve(backupDirectory, filename);
    const relative = path.relative(backupDirectory, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Invalid backup path');
    }
    return resolved;
};

const databaseArgs = () => [
    '--host', process.env.DB_HOST || 'localhost',
    '--port', String(process.env.DB_PORT || 3306),
    '--user', process.env.DB_USER || 'root'
];

const createDatabaseBackup = async (filename = createFilename()) => {
    await ensureBackupDirectory();
    const filePath = resolveBackupPath(filename);
    const output = fs.createWriteStream(filePath, { flags: 'wx', mode: 0o600 });
    try {
        const child = spawn(
            getExecutable('MYSQLDUMP_PATH', 'mysqldump'),
            [...databaseArgs(), '--single-transaction', '--routines', '--triggers', '--events', process.env.DB_NAME || 'momo_business_db'],
            {
                shell: false,
                windowsHide: true,
                env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
                stdio: ['ignore', 'pipe', 'pipe']
            }
        );
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.stdout.pipe(output);
        await new Promise((resolve, reject) => {
            let processDone = false;
            let outputDone = false;
            const finish = () => processDone && outputDone && resolve();
            child.on('error', reject);
            child.on('close', (code) => {
                if (code !== 0) return reject(new Error(`Backup utility exited with code ${code}: ${stderr}`));
                processDone = true;
                finish();
            });
            output.on('finish', () => {
                outputDone = true;
                finish();
            });
            output.on('error', reject);
        });
        const stats = await fs.promises.stat(filePath);
        if (!stats.isFile() || stats.size <= 0) throw new Error('Backup file is empty');
        return { filename, filePath, fileSize: stats.size };
    } catch (error) {
        output.destroy();
        await fs.promises.rm(filePath, { force: true });
        throw error;
    }
};

const createRecordedBackup = async (createdBy, { filename, auditAction = 'BACKUP_CREATED', description = 'Database backup created' } = {}) => {
    const file = await createDatabaseBackup(filename);
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const backupId = await backupModel.create(conn, {
            filename: file.filename,
            fileSize: file.fileSize,
            createdBy,
            status: 'COMPLETED'
        });
        await auditModel.create(conn, {
            userId: createdBy,
            action: auditAction,
            entityType: 'BACKUP',
            entityId: backupId,
            description,
            metadata: { filename: file.filename, size: file.fileSize }
        });
        await conn.commit();
        return { id: backupId, ...file };
    } catch (error) {
        await conn.rollback();
        await fs.promises.rm(file.filePath, { force: true });
        throw error;
    } finally {
        conn.release();
    }
};

const restoreDatabase = async (filePath) => {
    const input = fs.createReadStream(filePath);
    const child = spawn(getExecutable('MYSQL_PATH', 'mysql'), [...databaseArgs(), process.env.DB_NAME || 'momo_business_db'], {
        shell: false,
        windowsHide: true,
        env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
        stdio: ['pipe', 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    input.on('error', (error) => child.stdin.destroy(error));
    input.pipe(child.stdin);
    return new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Restore utility exited with code ${code}: ${stderr}`)));
    });
};

const validateRestoredDatabase = async () => {
    const placeholders = requiredTables.map(() => '?').join(', ');
    const [rows] = await db.execute(
        `SELECT TABLE_NAME FROM information_schema.tables
         WHERE table_schema = ? AND table_name IN (${placeholders})`,
        [process.env.DB_NAME || 'momo_business_db', ...requiredTables]
    );
    const found = new Set(rows.map((row) => row.TABLE_NAME));
    return requiredTables.every((table) => found.has(table));
};

module.exports = {
    backupDirectory,
    requiredTables,
    createFilename,
    resolveBackupPath,
    createDatabaseBackup,
    createRecordedBackup,
    restoreDatabase,
    validateRestoredDatabase
};