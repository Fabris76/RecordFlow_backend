const db = require('../config/database');

const getByVendorAndDate = async (vendorId, closingDate) => {
    const [rows] = await db.execute(
        `SELECT * FROM daily_closing WHERE vendor_id = ? AND closing_date = ? LIMIT 1`,
        [vendorId, closingDate]
    );
    return rows[0];
};

const getByVendorAndDateForUpdate = async (conn, vendorId, closingDate) => {
    const [rows] = await conn.execute(
        `SELECT * FROM daily_closing WHERE vendor_id = ? AND closing_date = ? LIMIT 1 FOR UPDATE`,
        [vendorId, closingDate]
    );
    return rows[0];
};

const getById = async (id) => {
    const [rows] = await db.execute(
        `SELECT dc.*, u.name AS vendor_name
         FROM daily_closing dc
         JOIN users u ON u.id = dc.vendor_id
         WHERE dc.id = ?
         LIMIT 1`,
        [id]
    );
    return rows[0];
};

const getTransactionTotals = async (conn, vendorId, closingDate) => {
    const [rows] = await conn.execute(
        `SELECT
            COUNT(*) AS total_transactions,
            COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) AS total_deposits,
            COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) AS total_withdrawals,
            COALESCE(SUM(CASE WHEN type = 'TRANSFER' THEN amount ELSE 0 END), 0) AS total_transfers,
            COALESCE(SUM(CASE WHEN type = 'AIRTIME' THEN amount ELSE 0 END), 0) AS total_airtime,
            COALESCE(SUM(CASE WHEN type = 'DATA' THEN amount ELSE 0 END), 0) AS total_data,
            COALESCE(SUM(CASE WHEN type = 'BILL_PAYMENT' THEN amount ELSE 0 END), 0) AS total_bill_payments,
            COALESCE(SUM(CASE WHEN type = 'OTHER' THEN amount ELSE 0 END), 0) AS total_other,
            COALESCE(SUM(amount), 0) AS total_amount
         FROM transactions
         WHERE vendor_id = ? AND transaction_date = ? AND status = 'COMPLETED'`,
        [vendorId, closingDate]
    );

    return {
        totalTransactions: rows[0].total_transactions,
        totalDeposits: rows[0].total_deposits,
        totalWithdrawals: rows[0].total_withdrawals,
        totalTransfers: rows[0].total_transfers,
        totalAirtime: rows[0].total_airtime,
        totalData: rows[0].total_data,
        totalBillPayments: rows[0].total_bill_payments,
        totalOther: rows[0].total_other,
        totalAmount: rows[0].total_amount
    };
};

const create = async (conn, vendorId, closingDate, totals) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const [result] = await conn.execute(
        `INSERT INTO daily_closing
         (vendor_id, closing_date, total_transactions, total_deposits, total_withdrawals, 
          total_transfers, total_airtime, total_data, total_bill_payments, total_other, total_amount, status, closed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLOSED', ?)`,
        [
            vendorId,
            closingDate,
            totals.totalTransactions,
            totals.totalDeposits,
            totals.totalWithdrawals,
            totals.totalTransfers,
            totals.totalAirtime,
            totals.totalData,
            totals.totalBillPayments,
            totals.totalOther,
            totals.totalAmount,
            now
        ]
    );

    return result.insertId;
};

const reopen = async (conn, closingId) => {
    const [result] = await conn.execute(
        `UPDATE daily_closing
         SET status = 'OPEN', closed_at = NULL
         WHERE id = ? AND status = 'CLOSED'`,
        [closingId]
    );
    return result.affectedRows > 0;
};

const close = async (conn, closingId, totals) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await conn.execute(
        `UPDATE daily_closing
         SET total_transactions = ?, total_deposits = ?, total_withdrawals = ?,
             total_transfers = ?, total_airtime = ?, total_data = ?, total_bill_payments = ?,
             total_other = ?, total_amount = ?, status = 'CLOSED', closed_at = ?
         WHERE id = ?`,
        [
            totals.totalTransactions, totals.totalDeposits, totals.totalWithdrawals,
            totals.totalTransfers, totals.totalAirtime, totals.totalData,
            totals.totalBillPayments, totals.totalOther, totals.totalAmount, now, closingId
        ]
    );
};

const getByVendorId = async (vendorId, pagination = {}) => {
    const { page = 1, limit = 20 } = pagination;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM daily_closing WHERE vendor_id = ?`,
        [vendorId]
    );

    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const [rows] = await db.execute(
        `SELECT * FROM daily_closing
         WHERE vendor_id = ?
         ORDER BY closing_date DESC
         LIMIT ? OFFSET ?`,
        [vendorId, safeLimit, offset]
    );

    return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages } };
};

const getAll = async (filters = {}, pagination = {}) => {
    const { vendorId, closingDate, status, startDate, endDate } = filters;
    const { page = 1, limit = 20 } = pagination;

    const conditions = ['1 = 1'];
    const params = [];

    if (vendorId) {
        conditions.push('dc.vendor_id = ?');
        params.push(Number(vendorId));
    }

    if (closingDate) {
        conditions.push('dc.closing_date = ?');
        params.push(closingDate);
    }

    if (status) {
        conditions.push('dc.status = ?');
        params.push(String(status).trim().toUpperCase());
    }

    if (startDate) {
        conditions.push('dc.closing_date >= ?');
        params.push(startDate);
    }

    if (endDate) {
        conditions.push('dc.closing_date <= ?');
        params.push(endDate);
    }

    const where = conditions.join(' AND ');

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM daily_closing dc WHERE ${where}`,
        params
    );

    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const [rows] = await db.execute(
        `SELECT dc.*, u.name AS vendor_name
         FROM daily_closing dc
         JOIN users u ON u.id = dc.vendor_id
         WHERE ${where}
         ORDER BY dc.closing_date DESC
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, offset]
    );

    return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages } };
};

module.exports = {
    getByVendorAndDate,
    getByVendorAndDateForUpdate,
    getById,
    getTransactionTotals,
    create,
    reopen,
    close,
    getByVendorId,
    getAll
};
