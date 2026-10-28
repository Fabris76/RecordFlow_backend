const db = require('../config/database');

const getByVendorId = async (vendorId) => {
    const [rows] = await db.execute(
        `SELECT * FROM vendor_balances WHERE vendor_id = ? LIMIT 1`,
        [vendorId]
    );
    return rows[0];
};

const create = async (conn, vendorId) => {
    const [result] = await conn.execute(
        `INSERT INTO vendor_balances (vendor_id, cash_balance, momo_balance) VALUES (?, 0.00, 0.00)`,
        [vendorId]
    );
    return result.insertId;
};

const updateBalance = async (conn, vendorId, balanceType, amount) => {
    if (balanceType === 'CASH') {
        await conn.execute(
            `UPDATE vendor_balances SET cash_balance = cash_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE vendor_id = ?`,
            [amount, vendorId]
        );
    } else if (balanceType === 'MOMO') {
        await conn.execute(
            `UPDATE vendor_balances SET momo_balance = momo_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE vendor_id = ?`,
            [amount, vendorId]
        );
    }
};

const getBalanceForUpdate = async (conn, vendorId) => {
    const [rows] = await conn.execute(
        `SELECT * FROM vendor_balances WHERE vendor_id = ? FOR UPDATE`,
        [vendorId]
    );
    return rows[0];
};

const getAllBalances = async () => {
    const [rows] = await db.execute(
        `SELECT vb.*, u.name AS vendor_name
         FROM vendor_balances vb
         JOIN users u ON u.id = vb.vendor_id
         WHERE u.role = 'VENDOR'
         ORDER BY u.name ASC`
    );
    return rows;
};

const getOwnerBalanceSummary = async () => {
    const [rows] = await db.execute(
        `SELECT
            COALESCE(SUM(vb.cash_balance), 0.00) AS total_cash_balance,
            COALESCE(SUM(vb.momo_balance), 0.00) AS total_momo_balance,
            MAX(vb.updated_at) AS last_updated,
            COUNT(*) AS vendor_count
         FROM vendor_balances vb
         JOIN users u ON u.id = vb.vendor_id
         WHERE u.role = 'VENDOR'`
    );
    return rows[0];
};

const getVendorBalance = async (vendorId) => {
    const [rows] = await db.execute(
        `SELECT vb.*, u.name AS vendor_name
         FROM vendor_balances vb
         JOIN users u ON u.id = vb.vendor_id
         WHERE vb.vendor_id = ? AND u.role = 'VENDOR'
         LIMIT 1`,
        [vendorId]
    );
    return rows[0];
};

module.exports = {
    getByVendorId,
    create,
    updateBalance,
    getBalanceForUpdate,
    getAllBalances,
    getOwnerBalanceSummary,
    getVendorBalance
};
