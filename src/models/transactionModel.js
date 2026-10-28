const db = require('../config/database');

const VALID_TYPES = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'AIRTIME', 'DATA', 'BILL_PAYMENT', 'OTHER'];

const createTransaction = async ({ vendorId, type, amount, customerReference }) => {
    const [result] = await db.execute(
        `INSERT INTO transactions (vendor_id, type, amount, customer_reference, transaction_date, transaction_time, status)
         VALUES (?, ?, ?, ?, CURRENT_DATE, CURRENT_TIME, 'COMPLETED')`,
        [vendorId, type, amount, customerReference || null]
    );

    const transactionId = result.insertId;
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const reference = `TX-${dateStamp}-${String(transactionId).padStart(6, '0')}`;

    await db.execute(
        'UPDATE transactions SET transaction_reference = ? WHERE id = ?',
        [reference, transactionId]
    );

    return getById(transactionId);
};

const getById = async (id) => {
    const [rows] = await db.execute(
        `SELECT t.*, u.name AS vendor_name
         FROM transactions t
         JOIN users u ON u.id = t.vendor_id
         WHERE t.id = ?
         LIMIT 1`,
        [id]
    );
    return rows[0];
};

const getByVendorId = async (vendorId, filters = {}, pagination = {}, sorting = {}) => {
    const {
        type, status, date, startDate, endDate,
        amount, minAmount, maxAmount,
        customerReference, transactionReference
    } = filters;
    const { page = 1, limit = 20 } = pagination;
    const { sortBy = 'created_at', sortOrder = 'desc' } = sorting;

    const conditions = ['t.vendor_id = ?'];
    const params = [vendorId];

    if (type) {
        conditions.push('t.type = ?');
        params.push(String(type).trim().toUpperCase());
    }

    if (status) {
        conditions.push('t.status = ?');
        params.push(String(status).trim().toUpperCase());
    }

    if (date) {
        conditions.push('t.transaction_date = ?');
        params.push(date);
    }

    if (startDate) {
        conditions.push('t.transaction_date >= ?');
        params.push(startDate);
    }

    if (endDate) {
        conditions.push('t.transaction_date <= ?');
        params.push(endDate);
    }

    if (amount !== undefined && amount !== null && amount !== '') {
        conditions.push('t.amount = ?');
        params.push(Number(amount));
    }

    if (minAmount !== undefined && minAmount !== null && minAmount !== '') {
        conditions.push('t.amount >= ?');
        params.push(Number(minAmount));
    }

    if (maxAmount !== undefined && maxAmount !== null && maxAmount !== '') {
        conditions.push('t.amount <= ?');
        params.push(Number(maxAmount));
    }

    if (customerReference) {
        conditions.push('t.customer_reference LIKE ?');
        params.push(`%${String(customerReference).trim()}%`);
    }

    if (transactionReference) {
        conditions.push('t.transaction_reference = ?');
        params.push(String(transactionReference).trim());
    }

    const where = conditions.join(' AND ');
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const allowedSortFields = ['amount', 'transaction_date', 'created_at', 'transaction_time'];
    const safeSort = allowedSortFields.includes(String(sortBy).toLowerCase()) ? sortBy : 'created_at';
    const safeSortOrder = ['asc', 'desc'].includes(String(sortOrder).toLowerCase()) ? sortOrder : 'desc';

    const orderBy = `t.${safeSort} ${safeSortOrder.toUpperCase()}`;

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM transactions t WHERE ${where}`,
        params
    );

    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const [rows] = await db.execute(
        `SELECT t.*, u.name AS vendor_name
         FROM transactions t
         JOIN users u ON u.id = t.vendor_id
         WHERE ${where}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, offset]
    );

    return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages } };
};

const getAll = async (filters = {}, pagination = {}, sorting = {}) => {
    const {
        type, status, vendorId, date, startDate, endDate,
        amount, minAmount, maxAmount,
        vendorName, customerReference, transactionReference
    } = filters;
    const { page = 1, limit = 20 } = pagination;
    const { sortBy = 'created_at', sortOrder = 'desc' } = sorting;

    const conditions = ['1 = 1'];
    const params = [];

    if (type) {
        conditions.push('t.type = ?');
        params.push(String(type).trim().toUpperCase());
    }

    if (status) {
        conditions.push('t.status = ?');
        params.push(String(status).trim().toUpperCase());
    }

    if (vendorId) {
        conditions.push('t.vendor_id = ?');
        params.push(Number(vendorId));
    }

    if (vendorName) {
        conditions.push('u.name LIKE ?');
        params.push(`%${String(vendorName).trim()}%`);
    }

    if (date) {
        conditions.push('t.transaction_date = ?');
        params.push(date);
    }

    if (startDate) {
        conditions.push('t.transaction_date >= ?');
        params.push(startDate);
    }

    if (endDate) {
        conditions.push('t.transaction_date <= ?');
        params.push(endDate);
    }

    if (amount !== undefined && amount !== null && amount !== '') {
        conditions.push('t.amount = ?');
        params.push(Number(amount));
    }

    if (minAmount !== undefined && minAmount !== null && minAmount !== '') {
        conditions.push('t.amount >= ?');
        params.push(Number(minAmount));
    }

    if (maxAmount !== undefined && maxAmount !== null && maxAmount !== '') {
        conditions.push('t.amount <= ?');
        params.push(Number(maxAmount));
    }

    if (customerReference) {
        conditions.push('t.customer_reference LIKE ?');
        params.push(`%${String(customerReference).trim()}%`);
    }

    if (transactionReference) {
        conditions.push('t.transaction_reference = ?');
        params.push(String(transactionReference).trim());
    }

    const where = conditions.join(' AND ');
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const allowedSortFields = ['amount', 'transaction_date', 'created_at', 'transaction_time'];
    const safeSort = allowedSortFields.includes(String(sortBy).toLowerCase()) ? sortBy : 'created_at';
    const safeSortOrder = ['asc', 'desc'].includes(String(sortOrder).toLowerCase()) ? sortOrder : 'desc';

    const orderBy = `t.${safeSort} ${safeSortOrder.toUpperCase()}`;

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM transactions t
         JOIN users u ON u.id = t.vendor_id
         WHERE ${where}`,
        params
    );

    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const [rows] = await db.execute(
        `SELECT t.*, u.name AS vendor_name
         FROM transactions t
         JOIN users u ON u.id = t.vendor_id
         WHERE ${where}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, offset]
    );

    return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages } };
};

module.exports = {
    VALID_TYPES,
    createTransaction,
    getById,
    getByVendorId,
    getAll
};
