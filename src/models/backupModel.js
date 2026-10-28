const db = require('../config/database');

const create = async (conn, { filename, fileSize, createdBy, status }) => {
    const connection = conn || db;
    const [result] = await connection.execute(
        `INSERT INTO backups (filename, file_size, created_by, status)
         VALUES (?, ?, ?, ?)`,
        [filename, fileSize, createdBy, status]
    );
    return result.insertId;
};

const getById = async (id) => {
    const [rows] = await db.execute(
        `SELECT b.*, u.name AS created_by_name
         FROM backups b
         JOIN users u ON u.id = b.created_by
         WHERE b.id = ?
         LIMIT 1`,
        [id]
    );
    return rows[0] || null;
};

const list = async ({ page = 1, limit = 20 } = {}) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await db.execute('SELECT COUNT(*) AS total FROM backups');
    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const [rows] = await db.execute(
        `SELECT b.id, b.filename, b.file_size, b.created_by, u.name AS created_by_name,
                b.created_at, b.status
         FROM backups b
         JOIN users u ON u.id = b.created_by
         ORDER BY b.created_at DESC, b.id DESC
         LIMIT ? OFFSET ?`,
        [safeLimit, offset]
    );

    return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages } };
};

module.exports = { create, getById, list };