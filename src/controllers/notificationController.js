const notificationModel = require('../models/notificationModel');
const notificationService = require('../services/notificationService');

const isValidDateString = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) return false;
    const [year, month, day] = String(date).trim().split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const parseIsRead = (value) => {
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
};

const validatePagination = ({ page, limit }) => {
    if (page !== undefined && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
        return 'Page must be a positive integer';
    }
    if (limit !== undefined && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
        return 'Limit must be a positive integer not greater than 100';
    }
    return null;
};

const formatNotification = (row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    is_read: Boolean(row.is_read),
    created_at: row.created_at,
    read_at: row.read_at
});

const getNotifications = async (req, res) => {
    try {
        const { type, is_read, start_date, end_date, sort_order, page, limit } = req.query;

        if (type && !notificationService.isValidType(type)) {
            return res.status(400).json({ success: false, message: 'Invalid notification type' });
        }

        const parsedIsRead = parseIsRead(is_read);
        if (parsedIsRead === null) {
            return res.status(400).json({ success: false, message: 'is_read must be true or false' });
        }

        if (start_date && !isValidDateString(start_date)) {
            return res.status(400).json({ success: false, message: 'Invalid start_date format. Use YYYY-MM-DD' });
        }
        if (end_date && !isValidDateString(end_date)) {
            return res.status(400).json({ success: false, message: 'Invalid end_date format. Use YYYY-MM-DD' });
        }
        if (start_date && end_date && String(start_date).trim() > String(end_date).trim()) {
            return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
        }

        if (sort_order && !['asc', 'desc'].includes(String(sort_order).toLowerCase())) {
            return res.status(400).json({ success: false, message: 'sort_order must be asc or desc' });
        }

        const paginationError = validatePagination({ page, limit });
        if (paginationError) {
            return res.status(400).json({ success: false, message: paginationError });
        }

        const result = await notificationModel.getNotifications(
            req.user.id,
            {
                type: type ? notificationService.normalizeType(type) : undefined,
                isRead: parsedIsRead,
                startDate: start_date,
                endDate: end_date
            },
            { page, limit },
            { sortOrder: sort_order }
        );

        return res.status(200).json({
            success: true,
            data: result.rows.map(formatNotification),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getUnreadNotifications = async (req, res) => {
    try {
        const result = await notificationModel.getNotifications(
            req.user.id,
            { isRead: false },
            {},
            { sortOrder: 'desc' }
        );
        return res.status(200).json({
            success: true,
            data: result.rows.map(formatNotification),
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get unread notifications error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const count = await notificationModel.getUnreadCount(req.user.id);
        return res.status(200).json({ success: true, data: { unread_count: count } });
    } catch (error) {
        console.error('Get unread count error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        if (isNaN(notificationId) || notificationId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid notification ID' });
        }

        const success = await notificationModel.markAsRead(req.user.id, notificationId);
        if (!success) {
            return res.status(404).json({ success: false, message: 'Notification not found or already read' });
        }

        return res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await notificationModel.markAllAsRead(req.user.id);
        return res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        if (!Number.isInteger(notificationId) || notificationId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid notification ID' });
        }
        const deleted = await notificationModel.deleteNotification(req.user.id, notificationId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        return res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getClosingPending = async (req, res) => {
    try {
        let { date } = req.query;
        if (!date) {
            const today = new Date();
            date = today.toISOString().split('T')[0];
        } else if (!isValidDateString(date)) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
        }

        const pending = await notificationModel.getClosingPending(date);
        
        const data = pending.map(v => ({
            vendor_id: v.vendor_id,
            vendor_name: v.vendor_name,
            date: date,
            status: 'PENDING'
        }));

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get closing pending error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    isValidDateString,
    parseIsRead,
    validatePagination,
    formatNotification,
    getNotifications,
    getUnreadNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getClosingPending
};
