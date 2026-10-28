const db = require('../config/database');

const completedTransactionWhere = (dateColumn = 'transaction_date') => `status = 'COMPLETED' AND ${dateColumn}`;

const getTransactionSummary = async (startDate, endDate) => {
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS transaction_count,
                COALESCE(SUM(amount), 0) AS transaction_amount,
                COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) AS deposits,
                COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) AS withdrawals,
                COALESCE(SUM(CASE WHEN type = 'TRANSFER' THEN amount ELSE 0 END), 0) AS transfers,
                COALESCE(SUM(CASE WHEN type = 'AIRTIME' THEN amount ELSE 0 END), 0) AS airtime,
                COALESCE(SUM(CASE WHEN type = 'DATA' THEN amount ELSE 0 END), 0) AS data,
                COALESCE(SUM(CASE WHEN type = 'BILL_PAYMENT' THEN amount ELSE 0 END), 0) AS bill_payments,
                COALESCE(SUM(CASE WHEN type = 'OTHER' THEN amount ELSE 0 END), 0) AS other_amount
         FROM transactions
         WHERE status = 'COMPLETED' AND transaction_date >= ? AND transaction_date <= ?`,
        [startDate, endDate]
    );
    return rows[0];
};

const getVendorCounts = async () => {
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(status = 'ACTIVE'), 0) AS active,
                COALESCE(SUM(status = 'INACTIVE'), 0) AS inactive
         FROM users WHERE role = 'VENDOR'`
    );
    return rows[0];
};

const getClosingCounts = async (date) => {
    const [rows] = await db.execute(
        `SELECT
            (SELECT COUNT(*) FROM daily_closing WHERE closing_date = ? AND status = 'CLOSED') AS completed,
            (SELECT COUNT(*) FROM users WHERE role = 'VENDOR' AND status = 'ACTIVE'
             AND NOT EXISTS (
                 SELECT 1 FROM daily_closing dc
                 WHERE dc.vendor_id = users.id AND dc.closing_date = ? AND dc.status = 'CLOSED'
             )) AS pending`,
        [date, date]
    );
    return rows[0];
};

const getVendorPerformance = async (startDate, endDate, sortBy, sortOrder) => {
    const [rows] = await db.execute(
        `SELECT t.vendor_id, u.name AS vendor_name,
                COUNT(*) AS transaction_count,
                COALESCE(SUM(t.amount), 0) AS transaction_amount
         FROM transactions t
         JOIN users u ON u.id = t.vendor_id
         WHERE t.status = 'COMPLETED' AND t.transaction_date >= ? AND t.transaction_date <= ?
         GROUP BY t.vendor_id, u.name
         ORDER BY ${sortBy} ${sortOrder}, t.vendor_id ASC`,
        [startDate, endDate]
    );
    return rows;
};

const getTransactionTypes = async (startDate, endDate) => {
    const [rows] = await db.execute(
        `SELECT type, COUNT(*) AS transaction_count, COALESCE(SUM(amount), 0) AS transaction_amount
         FROM transactions
         WHERE status = 'COMPLETED' AND transaction_date >= ? AND transaction_date <= ?
         GROUP BY type ORDER BY transaction_amount DESC, type ASC`,
        [startDate, endDate]
    );
    return rows;
};

const getTransactionTrend = async (startDate, endDate) => {
    const [rows] = await db.execute(
        `SELECT transaction_date AS date, COUNT(*) AS transaction_count,
                COALESCE(SUM(amount), 0) AS transaction_amount
         FROM transactions
         WHERE status = 'COMPLETED' AND transaction_date >= ? AND transaction_date <= ?
         GROUP BY transaction_date ORDER BY transaction_date ASC`,
        [startDate, endDate]
    );
    return rows;
};

const getComparisonSummary = async (startDate, endDate) => getTransactionSummary(startDate, endDate);

const getLargeTransactions = async (startDate, endDate, threshold) => {
    const [rows] = await db.execute(
        `SELECT t.id AS transaction_id, t.vendor_id, u.name AS vendor_name,
                t.type, t.amount, t.transaction_date AS date
         FROM transactions t
         JOIN users u ON u.id = t.vendor_id
         WHERE t.status = 'COMPLETED' AND t.amount >= ?
           AND t.transaction_date >= ? AND t.transaction_date <= ?
         ORDER BY t.amount DESC, t.transaction_date DESC, t.id DESC`,
        [threshold, startDate, endDate]
    );
    return rows;
};

const getActivitySummary = async (date, threshold) => {
    const [rows] = await db.execute(
        `SELECT
            (SELECT COUNT(*) FROM transactions WHERE status = 'COMPLETED' AND transaction_date = ?) AS transactions,
            (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'COMPLETED' AND transaction_date = ?) AS amount,
            (SELECT COUNT(*) FROM daily_closing WHERE closing_date = ? AND status = 'CLOSED') AS completed_closings,
            (SELECT COUNT(*) FROM users u WHERE u.role = 'VENDOR' AND u.status = 'ACTIVE'
             AND NOT EXISTS (SELECT 1 FROM daily_closing dc WHERE dc.vendor_id = u.id AND dc.closing_date = ? AND dc.status = 'CLOSED')) AS pending_closings,
            (SELECT COUNT(*) FROM transactions WHERE status = 'COMPLETED' AND transaction_date = ? AND amount >= ?) AS large_transactions,
            (SELECT COUNT(*) FROM transaction_history WHERE DATE(changed_at) = ?) AS transaction_edits,
            (SELECT COUNT(*) FROM balance_history WHERE reference_type = 'MANUAL_ADJUSTMENT' AND DATE(created_at) = ?) AS balance_adjustments`,
        [date, date, date, date, date, threshold, date, date]
    );
    const counts = await getVendorCounts();
    return { ...rows[0], active_vendors: counts.active, inactive_vendors: counts.inactive };
};

const getTransactionEditSummary = async () => {
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS total_edits, COUNT(DISTINCT t.vendor_id) AS vendors_with_edits
         FROM transaction_history th
         JOIN transactions t ON t.id = th.transaction_id`
    );
    return rows[0];
};

const getTopVendors = async (startDate, endDate) => {
    const [rows] = await db.execute(
        `SELECT t.vendor_id, u.name AS vendor_name, COUNT(*) AS transaction_count,
                COALESCE(SUM(t.amount), 0) AS transaction_amount
         FROM transactions t JOIN users u ON u.id = t.vendor_id
         WHERE t.status = 'COMPLETED' AND t.transaction_date >= ? AND t.transaction_date <= ?
         GROUP BY t.vendor_id, u.name
         ORDER BY transaction_count DESC, transaction_amount DESC, t.vendor_id ASC
         LIMIT 1`,
        [startDate, endDate]
    );
    const [valueRows] = await db.execute(
        `SELECT t.vendor_id, u.name AS vendor_name, COALESCE(SUM(t.amount), 0) AS transaction_amount
         FROM transactions t JOIN users u ON u.id = t.vendor_id
         WHERE t.status = 'COMPLETED' AND t.transaction_date >= ? AND t.transaction_date <= ?
         GROUP BY t.vendor_id, u.name
         ORDER BY transaction_amount DESC, t.vendor_id ASC
         LIMIT 1`,
        [startDate, endDate]
    );
    return { mostActive: rows[0] || null, highestValue: valueRows[0] || null };
};

const getVendorDashboardSummary = async (vendorId, date) => {
    const [transactionRows, balanceRows, closingRows] = await Promise.all([
        db.execute(
            `SELECT COUNT(*) AS transaction_count,
                    COALESCE(SUM(amount), 0) AS transaction_amount,
                    COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) AS deposits,
                    COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0) AS withdrawals
             FROM transactions
             WHERE vendor_id = ? AND status = 'COMPLETED' AND transaction_date = ?`,
            [vendorId, date]
        ),
        db.execute('SELECT cash_balance, momo_balance FROM vendor_balances WHERE vendor_id = ? LIMIT 1', [vendorId]),
        db.execute('SELECT status, closed_at FROM daily_closing WHERE vendor_id = ? AND closing_date = ? LIMIT 1', [vendorId, date])
    ]);
    return { transactions: transactionRows[0][0], balance: balanceRows[0][0] || null, closing: closingRows[0][0] || null };
};

module.exports = {
    getTransactionSummary,
    getVendorCounts,
    getClosingCounts,
    getVendorPerformance,
    getTransactionTypes,
    getTransactionTrend,
    getComparisonSummary,
    getActivitySummary,
    getLargeTransactions,
    getTransactionEditSummary,
    getTopVendors,
    getVendorDashboardSummary
};