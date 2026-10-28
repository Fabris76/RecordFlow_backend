const db = require('../config/database');

const buildBaseSelect = (tableAlias = '') => {
    const prefix = tableAlias ? `${tableAlias}.` : '';
    return `
        COALESCE(SUM(${prefix}amount), 0) AS total_amount,
        COUNT(*) AS total_transactions,
        COALESCE(SUM(CASE WHEN ${prefix}type = 'DEPOSIT' THEN ${prefix}amount ELSE 0 END), 0) AS total_deposits,
        COALESCE(SUM(CASE WHEN ${prefix}type = 'WITHDRAWAL' THEN ${prefix}amount ELSE 0 END), 0) AS total_withdrawals,
        COALESCE(SUM(CASE WHEN ${prefix}type = 'TRANSFER' THEN ${prefix}amount ELSE 0 END), 0) AS total_transfers,
        COALESCE(SUM(CASE WHEN ${prefix}type = 'AIRTIME' THEN ${prefix}amount ELSE 0 END), 0) AS total_airtime,
        COALESCE(SUM(CASE WHEN ${prefix}type = 'DATA' THEN ${prefix}amount ELSE 0 END), 0) AS total_data,
        COALESCE(SUM(CASE WHEN ${prefix}type = 'BILL_PAYMENT' THEN ${prefix}amount ELSE 0 END), 0) AS total_bill_payments,
        COALESCE(SUM(CASE WHEN ${prefix}type = 'OTHER' THEN ${prefix}amount ELSE 0 END), 0) AS total_other
    `;
};

const getDailyReport = async (date, vendorId) => {
    let query = `SELECT ${buildBaseSelect()} FROM transactions WHERE status = 'COMPLETED' AND transaction_date = ?`;
    const params = [date];

    if (vendorId) {
        query += ' AND vendor_id = ?';
        params.push(vendorId);
    }

    const [rows] = await db.execute(query, params);

    if (vendorId) {
        const [vendorRows] = await db.execute('SELECT name FROM users WHERE id = ? LIMIT 1', [vendorId]);
        if (vendorRows.length > 0) {
            rows[0].vendor_name = vendorRows[0].name;
        }
    }

    return rows[0];
};

const getWeeklyReport = async (startDate, endDate) => {
    const query = `SELECT ${buildBaseSelect()} FROM transactions WHERE status = 'COMPLETED' AND transaction_date >= ? AND transaction_date <= ?`;
    const params = [startDate, endDate];
    const [rows] = await db.execute(query, params);
    return rows[0];
};

const getMonthlyReport = async (year, month) => {
    const query = `SELECT ${buildBaseSelect()} FROM transactions WHERE status = 'COMPLETED' AND YEAR(transaction_date) = ? AND MONTH(transaction_date) = ?`;
    const params = [year, month];
    const [rows] = await db.execute(query, params);
    return rows[0];
};

const getTransactionTypesSummary = async (startDate, endDate) => {
    let query = `
        SELECT type, COUNT(*) AS transaction_count, COALESCE(SUM(amount), 0) AS total_amount
        FROM transactions
        WHERE status = 'COMPLETED'
    `;
    const params = [];

    if (startDate && endDate) {
        query += ' AND transaction_date >= ? AND transaction_date <= ?';
        params.push(startDate, endDate);
    }

    query += ' GROUP BY type ORDER BY total_amount DESC';
    const [rows] = await db.execute(query, params);
    return rows;
};

const getVendorPerformance = async (startDate, endDate, sortBy, sortOrder) => {
    let query = `
        SELECT
            t.vendor_id,
            u.name AS vendor_name,
            COUNT(t.id) AS transaction_count,
            COALESCE(SUM(t.amount), 0) AS total_amount,
            COALESCE(SUM(CASE WHEN t.type = 'DEPOSIT' THEN t.amount ELSE 0 END), 0) AS total_deposits,
            COALESCE(SUM(CASE WHEN t.type = 'WITHDRAWAL' THEN t.amount ELSE 0 END), 0) AS total_withdrawals
        FROM transactions t
        JOIN users u ON t.vendor_id = u.id
        WHERE t.status = 'COMPLETED'
    `;
    const params = [];

    if (startDate && endDate) {
        query += ' AND t.transaction_date >= ? AND t.transaction_date <= ?';
        params.push(startDate, endDate);
    }

    query += ' GROUP BY t.vendor_id, u.name';

    const safeSortBy = sortBy === 'transaction_count' ? 'transaction_count' : 'total_amount';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    const [rows] = await db.execute(query, params);
    return rows;
};

const getDailyTrendReport = async (startDate, endDate) => {
    let query = `
        SELECT
            transaction_date AS date,
            COUNT(id) AS transaction_count,
            COALESCE(SUM(amount), 0) AS total_amount
        FROM transactions
        WHERE status = 'COMPLETED'
    `;
    const params = [];

    if (startDate && endDate) {
        query += ' AND transaction_date >= ? AND transaction_date <= ?';
        params.push(startDate, endDate);
    }

    query += ' GROUP BY transaction_date ORDER BY transaction_date ASC';
    const [rows] = await db.execute(query, params);
    return rows;
};

const getClosingReport = async (startDate, endDate) => {
    let summaryQuery = `
        SELECT
            COUNT(*) AS total_days,
            COALESCE(SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END), 0) AS closed_days,
            COALESCE(SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END), 0) AS open_days
        FROM daily_closing
        WHERE 1 = 1
    `;
    let detailQuery = `
        SELECT
            dc.closing_date AS date,
            dc.vendor_id,
            u.name AS vendor_name,
            dc.status,
            dc.total_transactions,
            dc.total_amount,
            dc.closed_at
        FROM daily_closing dc
        JOIN users u ON dc.vendor_id = u.id
        WHERE 1 = 1
    `;

    const summaryParams = [];
    const detailParams = [];

    if (startDate && endDate) {
        summaryQuery += ' AND closing_date >= ? AND closing_date <= ?';
        detailQuery += ' AND dc.closing_date >= ? AND dc.closing_date <= ?';
        summaryParams.push(startDate, endDate);
        detailParams.push(startDate, endDate);
    }

    detailQuery += ' ORDER BY dc.closing_date DESC, dc.vendor_id ASC';

    const [summaryRows] = await db.execute(summaryQuery, summaryParams);
    const [detailRows] = await db.execute(detailQuery, detailParams);

    return {
        summary: summaryRows[0],
        details: detailRows
    };
};

module.exports = {
    getDailyTrendReport,
    getClosingReport,
    getDailyReport,
    getWeeklyReport,
    getMonthlyReport,
    getTransactionTypesSummary,
    getVendorPerformance
};
