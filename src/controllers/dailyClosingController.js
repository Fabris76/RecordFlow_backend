const dailyClosingModel = require('../models/dailyClosingModel');
const userModel = require('../models/userModel');
const vendorBalancesModel = require('../models/vendorBalancesModel');
const db = require('../config/database');
const notificationService = require('../services/notificationService');
const auditModel = require('../models/auditModel');

const isValidDate = (dateStr) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || '').trim())) return false;
    const [year, month, day] = String(dateStr).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr) => {
    const [year, month, day] = String(dateStr).split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatAmount = (amount) => Number(amount || 0).toFixed(2);

const formatClosingNotificationMessage = (user, closingDate, totals, balance) => (
    `Vendor ${user.name} (ID: ${user.id}, phone: ${user.phone}) completed the daily closing for ${formatDisplayDate(closingDate)}. `
    + `Transactions: ${totals.totalTransactions}; total amount: ${formatAmount(totals.totalAmount)}; `
    + `deposits: ${formatAmount(totals.totalDeposits)}; withdrawals: ${formatAmount(totals.totalWithdrawals)}; `
    + `transfers: ${formatAmount(totals.totalTransfers)}; airtime: ${formatAmount(totals.totalAirtime)}; `
    + `data: ${formatAmount(totals.totalData)}; bill payments: ${formatAmount(totals.totalBillPayments)}; `
    + `other: ${formatAmount(totals.totalOther)}. `
    + `Balances - cash: ${formatAmount(balance.cash_balance)}, MoMo: ${formatAmount(balance.momo_balance)}.`
);

const createClosing = async (req, res) => {
    const conn = await db.getConnection();
    try {
        if (!req.user || req.user.role !== 'VENDOR') {
            return res.status(403).json({ success: false, message: 'Vendor access required' });
        }

        const user = await userModel.getUserById(req.user.id);
        if (!user || user.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact the business owner.'
            });
        }

        const { closing_date } = req.body;

        if (!closing_date || !isValidDate(closing_date)) {
            return res.status(400).json({ success: false, message: 'Invalid closing date' });
        }

        const parsedDate = new Date(closing_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        parsedDate.setHours(0, 0, 0, 0);

        if (parsedDate > today) {
            return res.status(400).json({ success: false, message: 'Future closing dates are not allowed' });
        }

        const closingDateStr = formatDate(parsedDate);

        await conn.beginTransaction();

        const balance = await vendorBalancesModel.getBalanceForUpdate(conn, req.user.id);
        if (!balance) {
            await conn.rollback();
            return res.status(500).json({ success: false, message: 'Vendor balance record not found' });
        }
        const existing = await dailyClosingModel.getByVendorAndDateForUpdate(conn, req.user.id, closingDateStr);
        if (existing && existing.status === 'CLOSED') {
            await conn.rollback();
            return res.status(409).json({
                success: false,
                message: 'This business day has already been closed'
            });
        }

        const totals = await dailyClosingModel.getTransactionTotals(conn, req.user.id, closingDateStr);

        const closingId = existing
            ? existing.id
            : await dailyClosingModel.create(conn, req.user.id, closingDateStr, totals);
        if (existing) {
            await dailyClosingModel.close(conn, existing.id, totals);
        }

        await notificationService.notifyOwner(
            conn,
            'DAILY_CLOSING_COMPLETED',
            'Vendor Daily Closing Completed',
            formatClosingNotificationMessage(user, closingDateStr, totals, balance),
            'DAILY_CLOSING',
            closingId
        );

        await conn.commit();

        const closing = await dailyClosingModel.getById(closingId);

        return res.status(201).json({
            success: true,
            message: 'Business day closed successfully',
            data: {
                id: closing.id,
                vendor_id: closing.vendor_id,
                vendor_name: closing.vendor_name,
                closing_date: closing.closing_date,
                total_transactions: closing.total_transactions,
                total_deposits: Number(closing.total_deposits).toFixed(2),
                total_withdrawals: Number(closing.total_withdrawals).toFixed(2),
                total_transfers: Number(closing.total_transfers).toFixed(2),
                total_airtime: Number(closing.total_airtime).toFixed(2),
                total_data: Number(closing.total_data).toFixed(2),
                total_bill_payments: Number(closing.total_bill_payments).toFixed(2),
                total_other: Number(closing.total_other).toFixed(2),
                total_amount: Number(closing.total_amount).toFixed(2),
                status: closing.status,
                closed_at: closing.closed_at,
                cash_balance: Number(balance.cash_balance).toFixed(2),
                momo_balance: Number(balance.momo_balance).toFixed(2)
            }
        });
    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Create closing error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'This business day has already been closed'
            });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        conn.release();
    }
};

const reopenClosing = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const closingId = Number(req.params.id);
        if (!Number.isInteger(closingId) || closingId <= 0) {
            return res.status(400).json({ success: false, message: 'Closing ID must be a valid positive integer' });
        }
        await conn.beginTransaction();
        const closing = await dailyClosingModel.getById(closingId);
        if (!closing) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Closing not found' });
        }
        if (closing.status !== 'CLOSED') {
            await conn.rollback();
            return res.status(409).json({ success: false, message: 'This business day is already open' });
        }
        await dailyClosingModel.reopen(conn, closingId);
        await auditModel.create(conn, {
            userId: req.user.id,
            action: 'DAILY_CLOSING_REOPENED',
            entityType: 'DAILY_CLOSING',
            entityId: closingId,
            description: `Reopened ${closing.vendor_name}'s business day for ${closing.closing_date}.`,
            metadata: { vendor_id: closing.vendor_id, closing_date: closing.closing_date }
        });
        await conn.commit();
        return res.status(200).json({ success: true, message: 'Business day reopened successfully' });
    } catch (error) {
        await conn.rollback();
        console.error('Reopen closing error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        conn.release();
    }
};

const getTodayStatus = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'VENDOR') {
            return res.status(403).json({ success: false, message: 'Vendor access required' });
        }

        const today = new Date();
        const todayStr = formatDate(today);

        const closing = await dailyClosingModel.getByVendorAndDate(req.user.id, todayStr);
        const balance = await vendorBalancesModel.getByVendorId(req.user.id);
        const conn = await db.getConnection();
        let totals;
        try {
            totals = await dailyClosingModel.getTransactionTotals(conn, req.user.id, todayStr);
        } finally {
            conn.release();
        }

        if (!closing) {
            return res.status(200).json({
                success: true,
                data: {
                    date: todayStr,
                    status: 'OPEN',
                    total_transactions: Number(totals.totalTransactions),
                    total_amount: Number(totals.totalAmount).toFixed(2),
                    cash_balance: balance ? Number(balance.cash_balance).toFixed(2) : null,
                    momo_balance: balance ? Number(balance.momo_balance).toFixed(2) : null
                }
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                date: closing.closing_date,
                status: closing.status,
                total_transactions: closing.total_transactions,
                total_amount: Number(closing.total_amount).toFixed(2),
                closed_at: closing.closed_at,
                cash_balance: balance ? Number(balance.cash_balance).toFixed(2) : null,
                momo_balance: balance ? Number(balance.momo_balance).toFixed(2) : null
            }
        });
    } catch (error) {
        console.error('Get today status error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getMyClosings = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'VENDOR') {
            return res.status(403).json({ success: false, message: 'Vendor access required' });
        }

        const { page, limit } = req.query;
        const result = await dailyClosingModel.getByVendorId(req.user.id, { page, limit });

        return res.status(200).json({
            success: true,
            data: result.rows.map((row) => ({
                id: row.id,
                closing_date: row.closing_date,
                total_transactions: row.total_transactions,
                total_deposits: Number(row.total_deposits).toFixed(2),
                total_withdrawals: Number(row.total_withdrawals).toFixed(2),
                total_transfers: Number(row.total_transfers).toFixed(2),
                total_airtime: Number(row.total_airtime).toFixed(2),
                total_data: Number(row.total_data).toFixed(2),
                total_bill_payments: Number(row.total_bill_payments).toFixed(2),
                total_other: Number(row.total_other).toFixed(2),
                total_amount: Number(row.total_amount).toFixed(2),
                status: row.status,
                closed_at: row.closed_at
            })),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get my closings error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getAllClosings = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Owner access required' });
        }

        const { vendor_id, date, status, start_date, end_date, page, limit } = req.query;
        const result = await dailyClosingModel.getAll(
            {
                vendorId: vendor_id,
                closingDate: date,
                status,
                startDate: start_date,
                endDate: end_date
            },
            { page, limit }
        );

        return res.status(200).json({
            success: true,
            data: result.rows.map((row) => ({
                id: row.id,
                vendor_id: row.vendor_id,
                vendor_name: row.vendor_name,
                closing_date: row.closing_date,
                total_transactions: row.total_transactions,
                total_deposits: Number(row.total_deposits).toFixed(2),
                total_withdrawals: Number(row.total_withdrawals).toFixed(2),
                total_transfers: Number(row.total_transfers).toFixed(2),
                total_airtime: Number(row.total_airtime).toFixed(2),
                total_data: Number(row.total_data).toFixed(2),
                total_bill_payments: Number(row.total_bill_payments).toFixed(2),
                total_other: Number(row.total_other).toFixed(2),
                total_amount: Number(row.total_amount).toFixed(2),
                status: row.status,
                closed_at: row.closed_at
            })),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get all closings error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getClosingById = async (req, res) => {
    try {
        const { id } = req.params;
        const closingId = Number(id);

        if (!Number.isInteger(closingId) || closingId <= 0) {
            return res.status(400).json({ success: false, message: 'Closing ID must be a valid positive integer' });
        }

        const closing = await dailyClosingModel.getById(closingId);
        if (!closing) {
            return res.status(404).json({ success: false, message: 'Closing not found' });
        }

        if (req.user.role === 'VENDOR' && closing.vendor_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view this closing'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: closing.id,
                vendor_id: closing.vendor_id,
                vendor_name: closing.vendor_name,
                closing_date: closing.closing_date,
                total_transactions: closing.total_transactions,
                total_deposits: Number(closing.total_deposits).toFixed(2),
                total_withdrawals: Number(closing.total_withdrawals).toFixed(2),
                total_transfers: Number(closing.total_transfers).toFixed(2),
                total_airtime: Number(closing.total_airtime).toFixed(2),
                total_data: Number(closing.total_data).toFixed(2),
                total_bill_payments: Number(closing.total_bill_payments).toFixed(2),
                total_other: Number(closing.total_other).toFixed(2),
                total_amount: Number(closing.total_amount).toFixed(2),
                status: closing.status,
                closed_at: closing.closed_at
            }
        });
    } catch (error) {
        console.error('Get closing by id error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    isValidDate,
    formatDisplayDate,
    formatClosingNotificationMessage,
    createClosing,
    getTodayStatus,
    getMyClosings,
    getAllClosings,
    getClosingById
    ,reopenClosing
};
