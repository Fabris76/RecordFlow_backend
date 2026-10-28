const db = require('../config/database');

const transactionTotals = `
    COUNT(t.id) AS transaction_count,
    COALESCE(SUM(t.amount), 0) AS transaction_amount,
    COALESCE(SUM(CASE WHEN t.type = 'DEPOSIT' THEN t.amount ELSE 0 END), 0) AS deposits,
    COALESCE(SUM(CASE WHEN t.type = 'WITHDRAWAL' THEN t.amount ELSE 0 END), 0) AS withdrawals,
    COALESCE(SUM(CASE WHEN t.type = 'TRANSFER' THEN t.amount ELSE 0 END), 0) AS transfers,
    COALESCE(SUM(CASE WHEN t.type = 'AIRTIME' THEN t.amount ELSE 0 END), 0) AS airtime,
    COALESCE(SUM(CASE WHEN t.type = 'DATA' THEN t.amount ELSE 0 END), 0) AS data,
    COALESCE(SUM(CASE WHEN t.type = 'BILL_PAYMENT' THEN t.amount ELSE 0 END), 0) AS bill_payments,
    COALESCE(SUM(CASE WHEN t.type = 'OTHER' THEN t.amount ELSE 0 END), 0) AS other,
    COALESCE(SUM(CASE
        WHEN t.type = 'DEPOSIT' THEN t.amount
        WHEN t.type = 'WITHDRAWAL' THEN -t.amount
        ELSE 0
    END), 0) AS cash_movement,
    COALESCE(SUM(CASE
        WHEN t.type = 'DEPOSIT' THEN -t.amount
        WHEN t.type = 'WITHDRAWAL' THEN t.amount
        ELSE 0
    END), 0) AS momo_movement
`;

const mapRow = (row, businessDate) => ({
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    business_date: businessDate,
    opening_balance: null,
    current_balance: row.cash_balance === null || row.cash_balance === undefined ? null : {
        cash: Number(row.cash_balance).toFixed(2),
        momo: Number(row.momo_balance).toFixed(2),
        updated_at: row.balance_updated_at
    },
    transaction_activity: {
        count: Number(row.transaction_count || 0),
        amount: Number(row.transaction_amount || 0).toFixed(2),
        deposits: Number(row.deposits || 0).toFixed(2),
        withdrawals: Number(row.withdrawals || 0).toFixed(2),
        transfers: Number(row.transfers || 0).toFixed(2),
        airtime: Number(row.airtime || 0).toFixed(2),
        data: Number(row.data || 0).toFixed(2),
        bill_payments: Number(row.bill_payments || 0).toFixed(2),
        other: Number(row.other || 0).toFixed(2)
        ,cash_movement: Number(row.cash_movement || 0).toFixed(2)
        ,momo_movement: Number(row.momo_movement || 0).toFixed(2)
    },
    closing: row.closing_status ? {
        status: row.closing_status,
        closed_at: row.closed_at,
        transaction_count: row.closing_transaction_count,
        total_amount: row.closing_total_amount === null ? null : Number(row.closing_total_amount).toFixed(2),
        cash: null,
        momo: null
    } : { status: 'OPEN', closed_at: null, transaction_count: null, total_amount: null, cash: null, momo: null },
    reconciliation_status: null,
    difference: null
});

const getForVendorDate = async (vendorId, businessDate) => {
    const [rows] = await db.execute(
        `SELECT
            u.id AS vendor_id,
            u.name AS vendor_name,
            vb.cash_balance,
            vb.momo_balance,
            vb.updated_at AS balance_updated_at,
            dc.status AS closing_status,
            dc.closed_at,
            dc.total_transactions AS closing_transaction_count,
            dc.total_amount AS closing_total_amount,
            ${transactionTotals}
         FROM users u
         LEFT JOIN vendor_balances vb ON vb.vendor_id = u.id
         LEFT JOIN daily_closing dc ON dc.vendor_id = u.id AND dc.closing_date = ?
         LEFT JOIN transactions t ON t.vendor_id = u.id AND t.transaction_date = ? AND t.status = 'COMPLETED'
         WHERE u.id = ? AND u.role = 'VENDOR'
         GROUP BY u.id, u.name, vb.cash_balance, vb.momo_balance, vb.updated_at,
                  dc.status, dc.closed_at, dc.total_transactions, dc.total_amount
         LIMIT 1`,
        [businessDate, businessDate, vendorId]
    );
    return rows[0] ? mapRow(rows[0], businessDate) : null;
};

const getForOwner = async (businessDate, vendorId) => {
    const params = [businessDate, businessDate];
    let vendorCondition = '';
    if (vendorId !== undefined) {
        vendorCondition = ' AND u.id = ?';
        params.push(vendorId);
    }

    const [rows] = await db.execute(
        `SELECT
            u.id AS vendor_id,
            u.name AS vendor_name,
            vb.cash_balance,
            vb.momo_balance,
            vb.updated_at AS balance_updated_at,
            dc.status AS closing_status,
            dc.closed_at,
            dc.total_transactions AS closing_transaction_count,
            dc.total_amount AS closing_total_amount,
            ${transactionTotals}
         FROM users u
         LEFT JOIN vendor_balances vb ON vb.vendor_id = u.id
         LEFT JOIN daily_closing dc ON dc.vendor_id = u.id AND dc.closing_date = ?
         LEFT JOIN transactions t ON t.vendor_id = u.id AND t.transaction_date = ? AND t.status = 'COMPLETED'
         WHERE u.role = 'VENDOR'${vendorCondition}
         GROUP BY u.id, u.name, vb.cash_balance, vb.momo_balance, vb.updated_at,
                  dc.status, dc.closed_at, dc.total_transactions, dc.total_amount
         ORDER BY u.name ASC`,
        params
    );
    return rows.map((row) => mapRow(row, businessDate));
};

module.exports = { getForVendorDate, getForOwner };