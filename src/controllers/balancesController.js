const vendorBalancesModel = require('../models/vendorBalancesModel');
const balanceHistoryModel = require('../models/balanceHistoryModel');
const userModel = require('../models/userModel');
const db = require('../config/database');
const notificationService = require('../services/notificationService');
const dailyClosingModel = require('../models/dailyClosingModel');
const ownerBalanceModel = require('../models/ownerBalanceModel');
const auditModel = require('../models/auditModel');

const validateMoneyInput = (balance_type, amount, reason) => {
    const type = String(balance_type || '').trim().toUpperCase();
    if (!['CASH', 'MOMO'].includes(type)) return { message: 'Invalid balance type' };
    if (amount === null || amount === undefined || amount === '') return { message: 'Amount is required' };
    const value = Number(amount);
    if (typeof amount === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(amount.trim())) return { message: 'Amount must be a valid positive number with no more than two decimal places' };
    if (!Number.isFinite(value) || value <= 0 || value > 1000000000) return { message: 'Amount must be a positive number within the supported maximum' };
    if (!reason || String(reason).trim().length < 5 || String(reason).trim().length > 255) return { message: 'Reason must be between 5 and 255 characters' };
    return { type, value, reason: String(reason).trim() };
};

const getOwnerFunds = async (req, res) => {
    try {
        const funds = await ownerBalanceModel.get();
        return res.status(200).json({ success: true, data: funds });
    } catch (error) {
        console.error('Get owner funds error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const addOwnerFunds = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const type = String(req.body.balance_type || '').trim().toUpperCase();
        const operation = String(req.body.operation || 'ADD').trim().toUpperCase();
        const amount = Number(req.body.amount);
        if (!['CASH', 'MOMO'].includes(type)) return res.status(400).json({ success: false, message: 'Invalid balance type' });
        if (!['ADD', 'SUBTRACT'].includes(operation)) return res.status(400).json({ success: false, message: 'Invalid funds operation' });
        if (typeof req.body.amount === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(req.body.amount.trim())) {
            return res.status(400).json({ success: false, message: 'Amount must be a valid positive number with no more than two decimal places' });
        }
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
            return res.status(400).json({ success: false, message: 'Amount must be a positive number within the supported maximum' });
        }
        await conn.beginTransaction();
        const current = await ownerBalanceModel.getForUpdate(conn);
        const previous = type === 'CASH' ? Number(current.cash_balance) : Number(current.momo_balance);
        if (operation === 'SUBTRACT' && previous < amount) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: `Insufficient owner ${type.toLowerCase()} funds to subtract that amount` });
        }
        const change = operation === 'SUBTRACT' ? -amount : amount;
        await ownerBalanceModel.updateBalance(conn, type, change);
        await auditModel.create(conn, {
            userId: req.user.id, action: 'OWNER_FUNDS_ADDED', entityType: 'OWNER_BALANCE', entityId: 1,
            description: `${operation === 'SUBTRACT' ? 'Subtracted' : 'Added'} GHS ${amount.toFixed(2)} ${type} business funds.`,
            metadata: { balance_type: type, operation, amount, previous_balance: previous }
        });
        await conn.commit();
        return res.status(200).json({ success: true, message: 'Business funds added successfully', data: await ownerBalanceModel.get() });
    } catch (error) {
        await conn.rollback();
        console.error('Add owner funds error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally { conn.release(); }
};

const allocateOwnerFunds = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const validation = validateMoneyInput(req.body.balance_type, req.body.amount, req.body.reason);
        if (validation.message) return res.status(400).json({ success: false, message: validation.message });
        const vendorId = Number(req.params.vendorId);
        if (!Number.isInteger(vendorId) || vendorId <= 0) return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
        await conn.beginTransaction();
        const ownerFunds = await ownerBalanceModel.getForUpdate(conn);
        const vendorBalance = await vendorBalancesModel.getBalanceForUpdate(conn, vendorId);
        const vendor = await userModel.getUserById(vendorId);
        if (!vendor || vendor.role !== 'VENDOR' || !vendorBalance) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Vendor balance not found' }); }
        const available = validation.type === 'CASH' ? Number(ownerFunds.cash_balance) : Number(ownerFunds.momo_balance);
        if (available < validation.value) { await conn.rollback(); return res.status(400).json({ success: false, message: `Insufficient owner ${validation.type.toLowerCase()} funds` }); }
        const previousVendor = validation.type === 'CASH' ? Number(vendorBalance.cash_balance) : Number(vendorBalance.momo_balance);
        await ownerBalanceModel.updateBalance(conn, validation.type, -validation.value);
        await vendorBalancesModel.updateBalance(conn, vendorId, validation.type, validation.value);
        await balanceHistoryModel.insertHistoryEntry(conn, {
            vendorId, balanceType: validation.type, changeAmount: validation.value, previousBalance: previousVendor,
            newBalance: previousVendor + validation.value, reason: validation.reason, referenceType: 'OWNER_ALLOCATION',
            changedBy: req.user.id
        });
        await auditModel.create(conn, {
            userId: req.user.id, action: 'OWNER_FUNDS_ALLOCATED', entityType: 'VENDOR_BALANCE', entityId: vendorId,
            description: `Allocated GHS ${validation.value.toFixed(2)} ${validation.type} funds to ${vendor.name}.`,
            metadata: { balance_type: validation.type, amount: validation.value, reason: validation.reason }
        });
        await conn.commit();
        return res.status(200).json({ success: true, message: 'Funds allocated successfully', data: await vendorBalancesModel.getVendorBalance(vendorId) });
    } catch (error) {
        await conn.rollback();
        console.error('Allocate owner funds error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally { conn.release(); }
};

const getOwnBalance = async (req, res) => {
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

        const balance = await vendorBalancesModel.getByVendorId(req.user.id);
        if (!balance) {
            return res.status(404).json({ success: false, message: 'Balance record not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                vendor_id: balance.vendor_id,
                cash_balance: Number(balance.cash_balance).toFixed(2),
                momo_balance: Number(balance.momo_balance).toFixed(2),
                updated_at: balance.updated_at
            }
        });
    } catch (error) {
        console.error('Get own balance error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getAllBalances = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Owner access required' });
        }

        const balances = await vendorBalancesModel.getAllBalances();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const data = await Promise.all(balances.map(async (balance) => {
            const closing = await dailyClosingModel.getByVendorAndDate(balance.vendor_id, todayStr);
            return {
                vendor_id: balance.vendor_id,
                vendor_name: balance.vendor_name,
                cash_balance: Number(balance.cash_balance).toFixed(2),
                momo_balance: Number(balance.momo_balance).toFixed(2),
                updated_at: balance.updated_at,
                business_day_status: closing?.status || 'OPEN'
            };
        }));

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get all balances error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getOwnerBalanceSummary = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Owner access required' });
        }

        const summary = await vendorBalancesModel.getOwnerBalanceSummary();
        const balances = await vendorBalancesModel.getAllBalances();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const closings = await Promise.all(balances.map((balance) => dailyClosingModel.getByVendorAndDate(balance.vendor_id, todayStr)));
        const statuses = closings.map((closing) => closing?.status || 'OPEN');
        const businessDayStatus = statuses.length === 0 || statuses.every((status) => status === 'OPEN')
            ? 'OPEN'
            : statuses.every((status) => status === 'CLOSED') ? 'CLOSED' : 'MIXED';

        return res.status(200).json({
            success: true,
            data: {
                total_cash_balance: Number(summary.total_cash_balance).toFixed(2),
                total_momo_balance: Number(summary.total_momo_balance).toFixed(2),
                last_updated: summary.last_updated,
                vendor_count: Number(summary.vendor_count),
                business_day_status: businessDayStatus
            }
        });
    } catch (error) {
        console.error('Get owner balance summary error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getVendorBalance = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Owner access required' });
        }

        const { vendorId } = req.params;
        const vendorIdNum = Number(vendorId);

        if (!Number.isInteger(vendorIdNum) || vendorIdNum <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
        }

        const balance = await vendorBalancesModel.getVendorBalance(vendorIdNum);
        if (!balance) {
            return res.status(404).json({ success: false, message: 'Vendor or balance not found' });
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const closing = await dailyClosingModel.getByVendorAndDate(vendorIdNum, todayStr);

        return res.status(200).json({
            success: true,
            data: {
                vendor_id: balance.vendor_id,
                vendor_name: balance.vendor_name,
                cash_balance: Number(balance.cash_balance).toFixed(2),
                momo_balance: Number(balance.momo_balance).toFixed(2),
                updated_at: balance.updated_at,
                business_day_status: closing?.status || 'OPEN'
            }
        });
    } catch (error) {
        console.error('Get vendor balance error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const adjustBalance = async (req, res) => {
    const conn = await db.getConnection();
    try {
        if (!req.user || req.user.role !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Owner access required' });
        }

        const { vendorId } = req.params;
        const vendorIdNum = Number(vendorId);

        if (!Number.isInteger(vendorIdNum) || vendorIdNum <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
        }

        const { balance_type, amount, reason } = req.body;

        if (!balance_type || !['CASH', 'MOMO'].includes(String(balance_type).trim().toUpperCase())) {
            return res.status(400).json({ success: false, message: 'Invalid balance type' });
        }

        if (amount === null || amount === undefined || amount === '') {
            return res.status(400).json({ success: false, message: 'Amount is required' });
        }

        const amountNum = Number(amount);
        if (typeof amount === 'string' && !/^-?\d+(?:\.\d{1,2})?$/.test(amount.trim())) {
            return res.status(400).json({ success: false, message: 'Amount must be a valid number with no more than two decimal places' });
        }
        if (!Number.isFinite(amountNum) || amountNum === 0 || Math.abs(amountNum) > 1000000000) {
            return res.status(400).json({ success: false, message: 'Amount must be a non-zero number within the supported maximum' });
        }

        if (!reason || String(reason).trim().length < 5 || String(reason).trim().length > 255) {
            return res.status(400).json({ success: false, message: 'Reason must be between 5 and 255 characters' });
        }

        await conn.beginTransaction();

        const balance = await vendorBalancesModel.getBalanceForUpdate(conn, vendorIdNum);
        if (!balance) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Vendor balance not found' });
        }
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const closing = await dailyClosingModel.getByVendorAndDateForUpdate(conn, vendorIdNum, todayStr);
        if (closing && closing.status === 'CLOSED') {
            await conn.rollback();
            return res.status(403).json({
                success: false,
                message: 'This vendor’s business day is closed. Balances cannot be adjusted for this date.'
            });
        }

        const vendor = await userModel.getUserById(vendorIdNum);
        if (!vendor || vendor.role !== 'VENDOR') {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        const balanceTypeUpper = String(balance_type).trim().toUpperCase();
        const currentBalance = balanceTypeUpper === 'CASH' ? Number(balance.cash_balance) : Number(balance.momo_balance);
        const newBalance = currentBalance + amountNum;

        if (newBalance < 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'Adjustment would result in a negative balance'
            });
        }

        await vendorBalancesModel.updateBalance(conn, vendorIdNum, balanceTypeUpper, amountNum);

        await balanceHistoryModel.insertHistoryEntry(conn, {
            vendorId: vendorIdNum,
            balanceType: balanceTypeUpper,
            changeAmount: amountNum,
            previousBalance: currentBalance,
            newBalance: newBalance,
            reason: String(reason).trim(),
            referenceType: 'MANUAL_ADJUSTMENT',
            referenceId: null,
            changedBy: req.user.id
        });

        const balanceLabel = balanceTypeUpper === 'CASH' ? 'Cash' : 'MoMo';
        await notificationService.notifyOwner(
            conn,
            'BALANCE_ADJUSTED',
            'Balance Adjusted',
            `${balanceLabel} balance for ${vendor.name} was adjusted by GHS ${amountNum.toFixed(2)}.`,
            'BALANCE',
            vendorIdNum
        );

        await conn.commit();

        const updatedBalance = await vendorBalancesModel.getByVendorId(vendorIdNum);

        return res.status(200).json({
            success: true,
            message: 'Balance adjusted successfully',
            data: {
                vendor_id: updatedBalance.vendor_id,
                cash_balance: Number(updatedBalance.cash_balance).toFixed(2),
                momo_balance: Number(updatedBalance.momo_balance).toFixed(2),
                updated_at: updatedBalance.updated_at
            }
        });
    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Adjust balance error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        conn.release();
    }
};

const getOwnBalanceHistory = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'VENDOR') {
            return res.status(403).json({ success: false, message: 'Vendor access required' });
        }

        const { balance_type, start_date, end_date, page, limit } = req.query;

        const result = await balanceHistoryModel.getByVendorId(
            req.user.id,
            {
                balanceType: balance_type,
                startDate: start_date,
                endDate: end_date
            },
            { page, limit }
        );

        return res.status(200).json({
            success: true,
            data: result.rows.map((row) => ({
                id: row.id,
                balance_type: row.balance_type,
                change_amount: Number(row.change_amount).toFixed(2),
                previous_balance: Number(row.previous_balance).toFixed(2),
                new_balance: Number(row.new_balance).toFixed(2),
                reason: row.reason,
                reference_type: row.reference_type,
                reference_id: row.reference_id,
                changed_by_name: row.changed_by_name,
                created_at: row.created_at
            })),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get own balance history error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getAllBalanceHistory = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Owner access required' });
        }

        const { vendor_id, balance_type, start_date, end_date, page, limit } = req.query;

        const result = await balanceHistoryModel.getAll(
            {
                vendorId: vendor_id,
                balanceType: balance_type,
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
                balance_type: row.balance_type,
                change_amount: Number(row.change_amount).toFixed(2),
                previous_balance: Number(row.previous_balance).toFixed(2),
                new_balance: Number(row.new_balance).toFixed(2),
                reason: row.reason,
                reference_type: row.reference_type,
                reference_id: row.reference_id,
                changed_by_name: row.changed_by_name,
                created_at: row.created_at
            })),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get all balance history error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getOwnerFunds,
    addOwnerFunds,
    allocateOwnerFunds,
    getOwnBalance,
    getOwnerBalanceSummary,
    getAllBalances,
    getVendorBalance,
    adjustBalance,
    getOwnBalanceHistory,
    getAllBalanceHistory
};
