const db = require('../config/database');

const insertHistoryEntries = async (conn, transactionId, entries, changedBy) => {
    if (!Array.isArray(entries) || entries.length === 0) {
        return [];
    }

    const results = [];
    for (const entry of entries) {
        const [result] = await conn.execute(
            `INSERT INTO transaction_history (transaction_id, field_name, old_value, new_value, changed_by)
             VALUES (?, ?, ?, ?, ?)`,
            [
                transactionId,
                entry.field_name,
                entry.old_value === null || entry.old_value === undefined ? null : String(entry.old_value),
                entry.new_value === null || entry.new_value === undefined ? null : String(entry.new_value),
                changedBy
            ]
        );
        results.push(result);
    }

    return results;
};

const getByTransactionId = async (transactionId) => {
    const [rows] = await db.execute(
        `SELECT th.*, u.name AS changed_by_name
         FROM transaction_history th
         JOIN users u ON u.id = th.changed_by
         WHERE th.transaction_id = ?
         ORDER BY th.changed_at DESC`,
        [transactionId]
    );
    return rows;
};

const getAll = async (filters = {}) => {
    const { transactionId, vendorId, field, startDate, endDate } = filters;
    const conditions = ['1 = 1'];
    const params = [];

    if (transactionId) {
        conditions.push('th.transaction_id = ?');
        params.push(Number(transactionId));
    }

    if (vendorId) {
        conditions.push('t.vendor_id = ?');
        params.push(Number(vendorId));
    }

    if (field) {
        conditions.push('th.field_name = ?');
        params.push(String(field).trim());
    }

    if (startDate) {
        conditions.push('DATE(th.changed_at) >= ?');
        params.push(startDate);
    }

    if (endDate) {
        conditions.push('DATE(th.changed_at) <= ?');
        params.push(endDate);
    }

    const where = conditions.join(' AND ');

    const [rows] = await db.execute(
        `SELECT th.*, u.name AS changed_by_name, t.vendor_id, v.name AS vendor_name
         FROM transaction_history th
         JOIN users u ON u.id = th.changed_by
         JOIN transactions t ON t.id = th.transaction_id
         JOIN users v ON v.id = t.vendor_id
         WHERE ${where}
         ORDER BY th.changed_at DESC`,
        params
    );

    return rows;
};

module.exports = {
    insertHistoryEntries,
    getByTransactionId,
    getAll
};
