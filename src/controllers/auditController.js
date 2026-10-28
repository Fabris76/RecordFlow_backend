const auditModel = require('../models/auditModel');

const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(String(value));

const listAuditLogs = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
        const { action, entity_type: entityType, start_date: startDate, end_date: endDate } = req.query;
        if (!Number.isInteger(page) || !Number.isInteger(limit) || !validDate(startDate) || !validDate(endDate)) {
            return res.status(422).json({ success: false, message: 'Invalid audit filters' });
        }
        if (startDate && endDate && startDate > endDate) {
            return res.status(422).json({ success: false, message: 'Start date cannot be after end date' });
        }
        const result = await auditModel.list({ action, entityType, startDate, endDate, page, limit });
        return res.json({
            success: true,
            data: result.rows.map((row) => ({
                id: row.id, user_id: row.user_id, user_name: row.user_name, action: row.action,
                entity_type: row.entity_type, entity_id: row.entity_id, description: row.description,
                metadata: row.metadata, created_at: row.created_at
            })),
            pagination: { page, limit, total: result.total, total_pages: Math.ceil(result.total / limit) }
        });
    } catch (error) {
        console.error('List audit logs error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = { listAuditLogs };
