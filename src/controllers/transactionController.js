const transactionModel = require('../models/transactionModel');
const transactionHistoryModel = require('../models/transactionHistoryModel');
const dailyClosingModel = require('../models/dailyClosingModel');
const userModel = require('../models/userModel');
const vendorBalancesModel = require('../models/vendorBalancesModel');
const balanceHistoryModel = require('../models/balanceHistoryModel');
const db = require('../config/database');
const notificationService = require('../services/notificationService');

const VALID_TYPES = transactionModel.VALID_TYPES;

const BALANCE_EFFECTS = {
    DEPOSIT: { cash: 1, momo: -1 },
    WITHDRAWAL: { cash: -1, momo: 1 },
    TRANSFER: { cash: 0, momo: -1 },
    AIRTIME: { cash: 0, momo: -1 },
    DATA: { cash: 0, momo: -1 },
    BILL_PAYMENT: { cash: 0, momo: -1 },
    OTHER: { cash: 0, momo: 0 }
};

const getBalanceEffect = (type, amount) => {
    const effect = BALANCE_EFFECTS[type];
    return {
        cash: effect.cash * amount,
        momo: effect.momo * amount
    };
};

const isValidAmount = (amount) => {
    if (amount === null || amount === undefined || amount === '') return false;
    if (typeof amount === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(amount.trim())) return false;
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) return false;
    return numeric <= 1000000000 && Number(numeric.toFixed(2)) === numeric;
};

const normalizeType = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toUpperCase();
};

const createTransaction = async (req, res) => {
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

        const { type, amount, customer_reference } = req.body;
        const normalizedType = normalizeType(type);

        if (!normalizedType || !VALID_TYPES.includes(normalizedType)) {
            return res.status(400).json({ success: false, message: 'Transaction type is invalid' });
        }

        if (!isValidAmount(amount)) {
            return res.status(400).json({ success: false, message: 'Amount must be a valid number greater than 0' });
        }

        const cleanCustomerReference = customer_reference === undefined || customer_reference === null || String(customer_reference).trim() === ''
            ? null
            : String(customer_reference).trim().slice(0, 100);
        const idempotencyKey = typeof req.get('Idempotency-Key') === 'string'
            ? req.get('Idempotency-Key').trim().slice(0, 100)
            : '';

        const amountValue = Number(Number(amount).toFixed(2));
        if (amountValue > 1000000000) {
            return res.status(400).json({ success: false, message: 'Amount exceeds the supported maximum value' });
        }

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const closing = await dailyClosingModel.getByVendorAndDate(req.user.id, todayStr);
        if (closing && closing.status === 'CLOSED') {
            return res.status(403).json({
                success: false,
                message: 'The business day is already closed. New transactions cannot be recorded for this date.'
            });
        }

        await conn.beginTransaction();

        const balance = await vendorBalancesModel.getBalanceForUpdate(conn, req.user.id);
        if (!balance) {
            await conn.rollback();
            return res.status(500).json({ success: false, message: 'Vendor balance record not found' });
        }
        const lockedClosing = await dailyClosingModel.getByVendorAndDateForUpdate(conn, req.user.id, todayStr);
        if (lockedClosing && lockedClosing.status === 'CLOSED') {
            await conn.rollback();
            return res.status(403).json({
                success: false,
                message: 'The business day is already closed. New transactions cannot be recorded for this date.'
            });
        }

        if (idempotencyKey) {
            const [existingRows] = await conn.execute(
                `SELECT * FROM transactions WHERE vendor_id = ? AND idempotency_key = ? LIMIT 1`,
                [req.user.id, idempotencyKey]
            );
            if (existingRows[0]) {
                await conn.commit();
                return res.status(201).json({
                    success: true,
                    message: 'Transaction was already recorded',
                    data: {
                        id: existingRows[0].id,
                        transaction_reference: existingRows[0].transaction_reference,
                        vendor_id: existingRows[0].vendor_id,
                        type: existingRows[0].type,
                        amount: Number(existingRows[0].amount).toFixed(2),
                        customer_reference: existingRows[0].customer_reference,
                        transaction_date: existingRows[0].transaction_date,
                        transaction_time: existingRows[0].transaction_time,
                        status: existingRows[0].status
                    },
                    balance: {
                        vendor_id: balance.vendor_id,
                        cash_balance: Number(balance.cash_balance).toFixed(2),
                        momo_balance: Number(balance.momo_balance).toFixed(2),
                        updated_at: balance.updated_at
                    }
                });
            }
        }

        const balanceEffect = getBalanceEffect(normalizedType, amountValue);
        const nextCashBalance = Number(balance.cash_balance) + balanceEffect.cash;
        const nextMomoBalance = Number(balance.momo_balance) + balanceEffect.momo;
        if (nextCashBalance < 0 || nextMomoBalance < 0) {
            await conn.rollback();
            const insufficientBalance = balanceEffect.cash < 0 ? 'cash' : 'MoMo';
            const available = insufficientBalance === 'cash' ? balance.cash_balance : balance.momo_balance;
            return res.status(400).json({
                success: false,
                message: `Insufficient ${insufficientBalance} balance. Required: ${amountValue.toFixed(2)}, Available: ${Number(available).toFixed(2)}`
            });
        }

        const [txResult] = await conn.execute(
            `INSERT INTO transactions (vendor_id, type, amount, customer_reference, transaction_date, transaction_time, status, transaction_reference, idempotency_key)
             VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), 'COMPLETED', UUID(), ?)`,
            [req.user.id, normalizedType, amountValue, cleanCustomerReference, idempotencyKey || null]
        );
        const transactionId = txResult.insertId;

        await conn.execute(
            `UPDATE vendor_balances SET cash_balance = cash_balance + ?, momo_balance = momo_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE vendor_id = ?`,
            [balanceEffect.cash, balanceEffect.momo, req.user.id]
        );
        const updatedBalance = await vendorBalancesModel.getBalanceForUpdate(conn, req.user.id);

        for (const [balanceType, changeAmount, previousBalance, newBalance] of [
            ['CASH', balanceEffect.cash, Number(balance.cash_balance), nextCashBalance],
            ['MOMO', balanceEffect.momo, Number(balance.momo_balance), nextMomoBalance]
        ]) {
            if (changeAmount !== 0) {
                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: req.user.id,
                    balanceType,
                    changeAmount,
                    previousBalance,
                    newBalance,
                    reason: `${normalizedType} transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });
            }
        }

        const largeTransactionThreshold = notificationService.getLargeTransactionThreshold();
        if (amountValue >= largeTransactionThreshold) {
            await notificationService.notifyOwner(
                conn,
                'LARGE_TRANSACTION',
                'Large Transaction',
                `${user.name} recorded a GHS ${amountValue.toFixed(2)} ${normalizedType.toLowerCase().replace('_', ' ')}.`,
                'TRANSACTION',
                transactionId
            );
        }
        await notificationService.checkAndNotifyUnusualActivity(conn, user.id, user.name);
        await conn.commit();

        const [createdRows] = await conn.execute(
            `SELECT * FROM transactions WHERE id = ? LIMIT 1`,
            [transactionId]
        );
        const created = createdRows[0];

        return res.status(201).json({
            success: true,
            message: 'Transaction recorded successfully',
            data: {
                id: created.id,
                transaction_reference: created.transaction_reference,
                vendor_id: created.vendor_id,
                type: created.type,
                amount: Number(created.amount).toFixed(2),
                customer_reference: created.customer_reference,
                transaction_date: created.transaction_date,
                transaction_time: created.transaction_time,
                status: created.status
            },
            balance: {
                vendor_id: req.user.id,
                cash_balance: Number(updatedBalance.cash_balance).toFixed(2),
                momo_balance: Number(updatedBalance.momo_balance).toFixed(2),
                updated_at: updatedBalance.updated_at
            }
        });
    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Create transaction error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        conn.release();
    }
};

const getTransactions = async (req, res) => {
    try {
        const {
            type, status, vendor_id, vendor_name,
            date, start_date, end_date,
            amount, min_amount, max_amount,
            customer_reference, transaction_reference,
            sort_by, sort_order, page, limit
        } = req.query;

        if (type && !VALID_TYPES.includes(String(type).trim().toUpperCase())) {
            return res.status(400).json({ success: false, message: 'Invalid transaction type' });
        }

        if (status && !['COMPLETED', 'PENDING', 'FAILED'].includes(String(status).trim().toUpperCase())) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
        }

        if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(start_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid start_date format. Use YYYY-MM-DD' });
        }

        if (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(end_date).trim())) {
            return res.status(400).json({ success: false, message: 'Invalid end_date format. Use YYYY-MM-DD' });
        }

        if (start_date && end_date && String(start_date).trim() > String(end_date).trim()) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
        }

        if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) < 0)) {
            return res.status(400).json({ success: false, message: 'Amount must be a valid non-negative number' });
        }

        if (min_amount !== undefined && (isNaN(Number(min_amount)) || Number(min_amount) < 0)) {
            return res.status(400).json({ success: false, message: 'Minimum amount must be a valid non-negative number' });
        }

        if (max_amount !== undefined && (isNaN(Number(max_amount)) || Number(max_amount) < 0)) {
            return res.status(400).json({ success: false, message: 'Maximum amount must be a valid non-negative number' });
        }

        if (min_amount !== undefined && max_amount !== undefined && Number(min_amount) > Number(max_amount)) {
            return res.status(400).json({ success: false, message: 'Minimum amount cannot be greater than maximum amount' });
        }

        if (page && (isNaN(Number(page)) || Number(page) < 1)) {
            return res.status(400).json({ success: false, message: 'Page must be greater than zero' });
        }

        if (limit && (isNaN(Number(limit)) || Number(limit) < 1)) {
            return res.status(400).json({ success: false, message: 'Limit must be greater than zero' });
        }

        if (limit && Number(limit) > 100) {
            return res.status(400).json({ success: false, message: 'Limit cannot exceed 100' });
        }

        const allowedSortFields = ['amount', 'transaction_date', 'created_at', 'transaction_time'];
        if (sort_by && !allowedSortFields.includes(String(sort_by).toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Invalid sort field' });
        }

        if (sort_order && !['asc', 'desc'].includes(String(sort_order).toLowerCase())) {
            return res.status(400).json({ success: false, message: 'Invalid sort order. Use asc or desc' });
        }

        let result;
        if (req.user.role === 'VENDOR') {
            result = await transactionModel.getByVendorId(req.user.id, {
                type, status, date, startDate: start_date, endDate: end_date,
                amount, minAmount: min_amount, maxAmount: max_amount,
                customerReference: customer_reference, transactionReference: transaction_reference
            }, { page, limit }, { sortBy: sort_by, sortOrder: sort_order });
        } else if (req.user.role === 'OWNER') {
            if (vendor_id && (isNaN(Number(vendor_id)) || Number(vendor_id) <= 0)) {
                return res.status(400).json({ success: false, message: 'Vendor ID must be a valid positive integer' });
            }
            result = await transactionModel.getAll({
                type, status, vendorId: vendor_id, vendorName: vendor_name,
                date, startDate: start_date, endDate: end_date,
                amount, minAmount: min_amount, maxAmount: max_amount,
                customerReference: customer_reference, transactionReference: transaction_reference
            }, { page, limit }, { sortBy: sort_by, sortOrder: sort_order });
        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized role' });
        }

        return res.status(200).json({
            success: true,
            data: result.rows.map((row) => ({
                id: row.id,
                transaction_reference: row.transaction_reference,
                vendor_id: row.vendor_id,
                vendor_name: row.vendor_name,
                type: row.type,
                amount: Number(row.amount).toFixed(2),
                customer_reference: row.customer_reference,
                transaction_date: row.transaction_date,
                transaction_time: row.transaction_time,
                status: row.status
            })),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const transactionId = Number(id);

        if (!Number.isInteger(transactionId) || transactionId <= 0) {
            return res.status(400).json({ success: false, message: 'Transaction ID must be a valid positive integer' });
        }

        const transaction = await transactionModel.getById(transactionId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        if (req.user.role === 'VENDOR' && transaction.vendor_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view this transaction'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                id: transaction.id,
                transaction_reference: transaction.transaction_reference,
                vendor_id: transaction.vendor_id,
                vendor_name: transaction.vendor_name,
                type: transaction.type,
                amount: Number(transaction.amount).toFixed(2),
                customer_reference: transaction.customer_reference,
                transaction_date: transaction.transaction_date,
                transaction_time: transaction.transaction_time,
                status: transaction.status
            }
        });
    } catch (error) {
        console.error('Get one transaction error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateTransaction = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const transactionId = Number(id);

        if (!Number.isInteger(transactionId) || transactionId <= 0) {
            return res.status(400).json({ success: false, message: 'Transaction ID must be a valid positive integer' });
        }

        const user = await userModel.getUserById(req.user.id);
        if (!user || user.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact the business owner.'
            });
        }

        const transaction = await transactionModel.getById(transactionId);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        if (req.user.role === 'VENDOR' && transaction.vendor_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to edit this transaction'
            });
        }

        const closing = await dailyClosingModel.getByVendorAndDate(transaction.vendor_id, transaction.transaction_date);
        if (closing && closing.status === 'CLOSED') {
            return res.status(403).json({
                success: false,
                message: 'This transaction belongs to a closed business day and cannot be edited.'
            });
        }

        const { type, amount, customer_reference } = req.body;
        const payloadEntries = Object.entries({ type, amount, customer_reference }).filter(([, value]) => value !== undefined);

        if (payloadEntries.length === 0) {
            return res.status(400).json({ success: false, message: 'No changes were provided' });
        }

        const updates = {};
        const historyEntries = [];

        if (type !== undefined) {
            const normalizedType = normalizeType(type);
            if (!normalizedType || !VALID_TYPES.includes(normalizedType)) {
                return res.status(400).json({ success: false, message: 'Invalid transaction type' });
            }
            if (normalizedType !== transaction.type) {
                updates.type = normalizedType;
                historyEntries.push({
                    field_name: 'type',
                    old_value: transaction.type,
                    new_value: normalizedType
                });
            }
        }

        if (amount !== undefined) {
            if (!isValidAmount(amount)) {
                return res.status(400).json({ success: false, message: 'Amount must be a positive number with no more than two decimal places and within the supported maximum' });
            }
            const amountValue = Number(Number(amount).toFixed(2));
            if (Number(transaction.amount) !== amountValue) {
                updates.amount = amountValue;
                historyEntries.push({
                    field_name: 'amount',
                    old_value: String(transaction.amount),
                    new_value: String(amountValue)
                });
            }
        }

        if (customer_reference !== undefined) {
            const cleanCustomerReference = customer_reference === null || String(customer_reference).trim() === ''
                ? null
                : String(customer_reference).trim().slice(0, 100);
            if (String(transaction.customer_reference ?? '') !== String(cleanCustomerReference ?? '')) {
                updates.customer_reference = cleanCustomerReference;
                historyEntries.push({
                    field_name: 'customer_reference',
                    old_value: transaction.customer_reference === null ? null : String(transaction.customer_reference),
                    new_value: cleanCustomerReference === null ? null : String(cleanCustomerReference)
                });
            }
        }

        if (historyEntries.length === 0) {
            return res.status(400).json({ success: false, message: 'No changes were provided' });
        }

        const originalType = transaction.type;
        const originalAmount = Number(transaction.amount);
        const newType = updates.type || originalType;
        const newAmount = updates.amount !== undefined ? updates.amount : originalAmount;

        await conn.beginTransaction();
        const balance = await vendorBalancesModel.getBalanceForUpdate(conn, transaction.vendor_id);
        if (!balance) {
            await conn.rollback();
            return res.status(500).json({ success: false, message: 'Vendor balance record not found' });
        }
        const lockedClosing = await dailyClosingModel.getByVendorAndDateForUpdate(conn, transaction.vendor_id, transaction.transaction_date);
        if (lockedClosing && lockedClosing.status === 'CLOSED') {
            await conn.rollback();
            return res.status(403).json({
                success: false,
                message: 'This transaction belongs to a closed business day and cannot be edited.'
            });
        }

        if (originalType !== newType || originalAmount !== newAmount) {
            let cashBalanceAfterReversal = Number(balance.cash_balance);
            let momoBalanceAfterReversal = Number(balance.momo_balance);

            if (originalType === 'DEPOSIT') {
                cashBalanceAfterReversal -= originalAmount;
                momoBalanceAfterReversal += originalAmount;
            } else if (originalType === 'WITHDRAWAL') {
                cashBalanceAfterReversal += originalAmount;
                momoBalanceAfterReversal -= originalAmount;
            } else {
                const originalEffect = getBalanceEffect(originalType, originalAmount);
                cashBalanceAfterReversal -= originalEffect.cash;
                momoBalanceAfterReversal -= originalEffect.momo;
            }

            if (newType === 'DEPOSIT') {
                if (momoBalanceAfterReversal < newAmount) {
                    await conn.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `After reversing the original ${originalType} transaction, insufficient MoMo balance for new DEPOSIT. Required: ${newAmount.toFixed(2)}, Available: ${momoBalanceAfterReversal.toFixed(2)}`
                    });
                }
                cashBalanceAfterReversal += newAmount;
                momoBalanceAfterReversal -= newAmount;
            } else if (newType === 'WITHDRAWAL') {
                if (cashBalanceAfterReversal < newAmount) {
                    await conn.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `After reversing the original ${originalType} transaction, insufficient cash balance for new WITHDRAWAL. Required: ${newAmount.toFixed(2)}, Available: ${cashBalanceAfterReversal.toFixed(2)}`
                    });
                }
                cashBalanceAfterReversal -= newAmount;
                momoBalanceAfterReversal += newAmount;
            } else {
                const newEffect = getBalanceEffect(newType, newAmount);
                const projectedCashBalance = cashBalanceAfterReversal + newEffect.cash;
                const projectedMomoBalance = momoBalanceAfterReversal + newEffect.momo;
                if (projectedCashBalance < 0 || projectedMomoBalance < 0) {
                    await conn.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient balance for the updated transaction'
                    });
                }
                cashBalanceAfterReversal = projectedCashBalance;
                momoBalanceAfterReversal = projectedMomoBalance;
            }

            if (cashBalanceAfterReversal < 0 || momoBalanceAfterReversal < 0) {
                await conn.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Balance adjustment would result in negative balances'
                });
            }

            const currentCashBalance = Number(balance.cash_balance);
            const currentMomoBalance = Number(balance.momo_balance);

            if (originalType === 'DEPOSIT') {
                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: transaction.vendor_id,
                    balanceType: 'CASH',
                    changeAmount: -originalAmount,
                    previousBalance: currentCashBalance,
                    newBalance: currentCashBalance - originalAmount,
                    reason: `Reversal of DEPOSIT transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });

                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: transaction.vendor_id,
                    balanceType: 'MOMO',
                    changeAmount: originalAmount,
                    previousBalance: currentMomoBalance,
                    newBalance: currentMomoBalance + originalAmount,
                    reason: `Reversal of DEPOSIT transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });
            } else if (originalType === 'WITHDRAWAL') {
                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: transaction.vendor_id,
                    balanceType: 'CASH',
                    changeAmount: originalAmount,
                    previousBalance: currentCashBalance,
                    newBalance: currentCashBalance + originalAmount,
                    reason: `Reversal of WITHDRAWAL transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });

                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: transaction.vendor_id,
                    balanceType: 'MOMO',
                    changeAmount: -originalAmount,
                    previousBalance: currentMomoBalance,
                    newBalance: currentMomoBalance - originalAmount,
                    reason: `Reversal of WITHDRAWAL transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });
            } else {
                const originalEffect = getBalanceEffect(originalType, originalAmount);
                for (const [balanceType, changeAmount, previousBalance, newBalance] of [
                    ['CASH', -originalEffect.cash, currentCashBalance, currentCashBalance - originalEffect.cash],
                    ['MOMO', -originalEffect.momo, currentMomoBalance, currentMomoBalance - originalEffect.momo]
                ]) {
                    if (changeAmount !== 0) {
                        await balanceHistoryModel.insertHistoryEntry(conn, {
                            vendorId: transaction.vendor_id,
                            balanceType,
                            changeAmount,
                            previousBalance,
                            newBalance,
                            reason: `Reversal of ${originalType} transaction #${transactionId}`,
                            referenceType: 'TRANSACTION',
                            referenceId: transactionId,
                            changedBy: req.user.id
                        });
                    }
                }
            }

            if (newType === 'DEPOSIT') {
                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: transaction.vendor_id,
                    balanceType: 'CASH',
                    changeAmount: newAmount,
                    previousBalance: cashBalanceAfterReversal - newAmount,
                    newBalance: cashBalanceAfterReversal,
                    reason: `Updated DEPOSIT transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });

                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: transaction.vendor_id,
                    balanceType: 'MOMO',
                    changeAmount: -newAmount,
                    previousBalance: momoBalanceAfterReversal + newAmount,
                    newBalance: momoBalanceAfterReversal,
                    reason: `Updated DEPOSIT transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });
            } else if (newType === 'WITHDRAWAL') {
                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: transaction.vendor_id,
                    balanceType: 'CASH',
                    changeAmount: -newAmount,
                    previousBalance: cashBalanceAfterReversal + newAmount,
                    newBalance: cashBalanceAfterReversal,
                    reason: `Updated WITHDRAWAL transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });

                await balanceHistoryModel.insertHistoryEntry(conn, {
                    vendorId: transaction.vendor_id,
                    balanceType: 'MOMO',
                    changeAmount: newAmount,
                    previousBalance: momoBalanceAfterReversal - newAmount,
                    newBalance: momoBalanceAfterReversal,
                    reason: `Updated WITHDRAWAL transaction #${transactionId}`,
                    referenceType: 'TRANSACTION',
                    referenceId: transactionId,
                    changedBy: req.user.id
                });
            } else {
                const newEffect = getBalanceEffect(newType, newAmount);
                for (const [balanceType, changeAmount, previousBalance, newBalance] of [
                    ['CASH', newEffect.cash, cashBalanceAfterReversal - newEffect.cash, cashBalanceAfterReversal],
                    ['MOMO', newEffect.momo, momoBalanceAfterReversal - newEffect.momo, momoBalanceAfterReversal]
                ]) {
                    if (changeAmount !== 0) {
                        await balanceHistoryModel.insertHistoryEntry(conn, {
                            vendorId: transaction.vendor_id,
                            balanceType,
                            changeAmount,
                            previousBalance,
                            newBalance,
                            reason: `Updated ${newType} transaction #${transactionId}`,
                            referenceType: 'TRANSACTION',
                            referenceId: transactionId,
                            changedBy: req.user.id
                        });
                    }
                }
            }

            await conn.execute(
                `UPDATE vendor_balances SET cash_balance = ?, momo_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE vendor_id = ?`,
                [cashBalanceAfterReversal, momoBalanceAfterReversal, transaction.vendor_id]
            );
        }

        const fields = [];
        const values = [];
        Object.entries(updates).forEach(([key, value]) => {
            fields.push(`${key} = ?`);
            values.push(value);
        });

        if (fields.length > 0) {
            await conn.execute(
                `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
                [...values, transactionId]
            );
        }

        await transactionHistoryModel.insertHistoryEntries(conn, transactionId, historyEntries, req.user.id);
        await notificationService.notifyOwner(
            conn,
            'TRANSACTION_EDITED',
            'Transaction Edited',
            `Transaction ${transaction.transaction_reference} was edited by ${transaction.vendor_name || user.name}.`,
            'TRANSACTION',
            transactionId
        );

        const largeTransactionThreshold = notificationService.getLargeTransactionThreshold();
        if (
            transaction.status === 'COMPLETED' &&
            updates.amount !== undefined &&
            originalAmount < largeTransactionThreshold &&
            newAmount >= largeTransactionThreshold
        ) {
            await notificationService.notifyOwner(
                conn,
                'LARGE_TRANSACTION',
                'Large Transaction',
                `${transaction.vendor_name || user.name} recorded a GHS ${newAmount.toFixed(2)} ${newType.toLowerCase().replace('_', ' ')}.`,
                'TRANSACTION',
                transactionId
            );
        }
        await conn.commit();

        const updatedTransaction = await transactionModel.getById(transactionId);

        return res.status(200).json({
            success: true,
            message: 'Transaction updated successfully',
            data: {
                id: updatedTransaction.id,
                transaction_reference: updatedTransaction.transaction_reference,
                vendor_id: updatedTransaction.vendor_id,
                vendor_name: updatedTransaction.vendor_name,
                type: updatedTransaction.type,
                amount: Number(updatedTransaction.amount).toFixed(2),
                customer_reference: updatedTransaction.customer_reference,
                transaction_date: updatedTransaction.transaction_date,
                transaction_time: updatedTransaction.transaction_time,
                status: updatedTransaction.status
            }
        });
    } catch (error) {
        if (conn) {
            await conn.rollback();
        }
        console.error('Update transaction error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        conn.release();
    }
};

module.exports = {
    isValidAmount,
    normalizeType,
    getBalanceEffect,
    createTransaction,
    getTransactions,
    getTransactionById,
    updateTransaction
};
