const db = require('../config/database');

const insertHistoryEntry = async (conn, entry) => {
    const [result] = await conn.execute(
        `INSERT INTO balance_history
         (vendor_id, balance_type, change_amount, previous_balance, new_balance, reason, reference_type, reference_id, changed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            entry.vendorId,
            entry.balanceType,
            entry.changeAmount,
            entry.previousBalance,
            entry.newBalance,
            entry.reason,
            entry.referenceType || null,
            entry.referenceId || null,
            entry.changedBy
        ]
    );
    return result.insertId;
};

const getByVendorId = async (vendorId, filters = {}, pagination = {}) => {
    const { balanceType, startDate, endDate } = filters;
    const { page = 1, limit = 20 } = pagination;

    const conditions = ['bh.vendor_id = ?'];
    const params = [vendorId];

    if (balanceType) {
        conditions.push('bh.balance_type = ?');
        params.push(String(balanceType).trim().toUpperCase());
    }

    if (startDate) {
        conditions.push('DATE(bh.created_at) >= ?');
        params.push(startDate);
    }

    if (endDate) {
        conditions.push('DATE(bh.created_at) <= ?');
        params.push(endDate);
    }

    const where = conditions.join(' AND ');

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM balance_history bh WHERE ${where}`,
        params
    );

    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const [rows] = await db.execute(
        `SELECT bh.*, u.name AS changed_by_name
         FROM balance_history bh
         JOIN users u ON u.id = bh.changed_by
         WHERE ${where}
         ORDER BY bh.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, offset]
    );

    return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages } };
};

const getAll = async (filters = {}, pagination = {}) => {
    const { vendorId, balanceType, startDate, endDate } = filters;
    const { page = 1, limit = 20 } = pagination;

    const conditions = ['1 = 1'];
    const params = [];

    if (vendorId) {
        conditions.push('bh.vendor_id = ?');
        params.push(Number(vendorId));
    }

    if (balanceType) {
        conditions.push('bh.balance_type = ?');
        params.push(String(balanceType).trim().toUpperCase());
    }

    if (startDate) {
        conditions.push('DATE(bh.created_at) >= ?');
        params.push(startDate);
    }

    if (endDate) {
        conditions.push('DATE(bh.created_at) <= ?');
        params.push(endDate);
    }

    const where = conditions.join(' AND ');

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM balance_history bh WHERE ${where}`,
        params
    );

    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const [rows] = await db.execute(
        `SELECT bh.*, u.name AS vendor_name, u2.name AS changed_by_name
         FROM balance_history bh
         JOIN users u ON u.id = bh.vendor_id
         JOIN users u2 ON u2.id = bh.changed_by
         WHERE ${where}
         ORDER BY bh.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, offset]
    );

    return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages } };
};

module.exports = {
    insertHistoryEntry,
    getByVendorId,
    getAll
};
