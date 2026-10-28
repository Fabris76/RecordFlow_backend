const transactionModel = require('../models/transactionModel');
const transactionHistoryModel = require('../models/transactionHistoryModel');

const getTransactionHistory = async (req, res) => {
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
                message: 'You are not authorized to view this transaction history'
            });
        }

        const history = await transactionHistoryModel.getByTransactionId(transactionId);
        return res.status(200).json({
            success: true,
            data: history.map((row) => ({
                id: row.id,
                transaction_id: row.transaction_id,
                field_name: row.field_name,
                old_value: row.old_value,
                new_value: row.new_value,
                changed_by: row.changed_by,
                changed_by_name: row.changed_by_name,
                changed_at: row.changed_at
            }))
        });
    } catch (error) {
        console.error('Get transaction history error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getAllTransactionHistory = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Owner access required' });
        }

        const { transaction_id, vendor_id, field, start_date, end_date } = req.query;
        const history = await transactionHistoryModel.getAll({
            transactionId: transaction_id,
            vendorId: vendor_id,
            field,
            startDate: start_date,
            endDate: end_date
        });

        return res.status(200).json({
            success: true,
            data: history.map((row) => ({
                id: row.id,
                transaction_id: row.transaction_id,
                vendor_id: row.vendor_id,
                vendor_name: row.vendor_name,
                field_name: row.field_name,
                old_value: row.old_value,
                new_value: row.new_value,
                changed_by: row.changed_by,
                changed_by_name: row.changed_by_name,
                changed_at: row.changed_at
            }))
        });
    } catch (error) {
        console.error('Get all transaction history error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getTransactionHistory,
    getAllTransactionHistory
};
