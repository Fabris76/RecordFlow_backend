const db = require('../config/database');

const createNotification = async (conn, { recipientId, type, title, message, entityType, entityId }) => {
    const connection = conn || db;
    const [result] = await connection.execute(
        `INSERT INTO notifications (recipient_id, type, title, message, entity_type, entity_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [recipientId, type, title, message, entityType || null, entityId || null]
    );
    return result.insertId;
};

const getNotifications = async (recipientId, filters = {}, pagination = {}, sorting = {}) => {
    const { type, isRead, startDate, endDate } = filters;
    const { page = 1, limit = 20 } = pagination;
    const { sortOrder = 'desc' } = sorting;

    const conditions = ['recipient_id = ?'];
    const params = [recipientId];

    if (type) {
        conditions.push('type = ?');
        params.push(String(type).trim());
    }

    if (isRead !== undefined) {
        conditions.push('is_read = ?');
        params.push(isRead ? 1 : 0);
    }

    if (startDate) {
        conditions.push('created_at >= ?');
        params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
        conditions.push('created_at <= ?');
        params.push(`${endDate} 23:59:59`);
    }

    const where = conditions.join(' AND ');
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM notifications WHERE ${where}`,
        params
    );
    
    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const [rows] = await db.execute(
        `SELECT id, type, title, message, entity_type, entity_id, is_read, created_at, read_at
         FROM notifications
         WHERE ${where}
         ORDER BY created_at ${safeSortOrder}, id ${safeSortOrder}
         LIMIT ? OFFSET ?`,
        [...params, safeLimit, offset]
    );

    return { rows, pagination: { page: safePage, limit: safeLimit, total, totalPages } };
};

const getUnreadCount = async (recipientId) => {
    const [rows] = await db.execute(
        'SELECT COUNT(*) AS unread_count FROM notifications WHERE recipient_id = ? AND is_read = ?',
        [recipientId, 0]
    );
    return Number(rows[0].unread_count || 0);
};

const markAsRead = async (recipientId, notificationId) => {
    const [result] = await db.execute(
        'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_id = ? AND is_read = FALSE',
        [notificationId, recipientId]
    );
    return result.affectedRows > 0;
};

const markAllAsRead = async (recipientId) => {
    const [result] = await db.execute(
        'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE recipient_id = ? AND is_read = FALSE',
        [recipientId]
    );
    return result.affectedRows;
};

const deleteNotification = async (recipientId, notificationId) => {
    const [result] = await db.execute(
        'DELETE FROM notifications WHERE id = ? AND recipient_id = ?',
        [notificationId, recipientId]
    );
    return result.affectedRows > 0;
};

const checkRecentUnusualActivityAlert = async (conn, vendorId) => {
    const connection = conn || db;
    // Avoid duplicate UNUSUAL_ACTIVITY notifications within 10 minutes for this vendor
    const [rows] = await connection.execute(
        `SELECT id FROM notifications
         WHERE type = 'UNUSUAL_ACTIVITY' AND entity_type = 'VENDOR' AND entity_id = ? 
         AND created_at >= NOW() - INTERVAL 10 MINUTE LIMIT 1`,
        [vendorId]
    );
    return rows.length > 0;
};

const countRecentTransactions = async (conn, vendorId) => {
    const connection = conn || db;
    const [rows] = await connection.execute(
        `SELECT COUNT(*) as tx_count FROM transactions
         WHERE vendor_id = ? AND status = 'COMPLETED' 
         AND created_at >= NOW() - INTERVAL 10 MINUTE`,
        [vendorId]
    );
    return Number(rows[0].tx_count || 0);
};

const getClosingPending = async (date) => {
    // Find active vendors who do not have a closing record for the specified date
    const [rows] = await db.execute(
        `SELECT u.id AS vendor_id, u.name AS vendor_name
         FROM users u
         JOIN vendors v ON u.id = v.user_id
         WHERE u.role = 'VENDOR' AND u.status = 'ACTIVE'
         AND NOT EXISTS (
             SELECT 1 FROM daily_closing dc 
             WHERE dc.vendor_id = u.id AND dc.closing_date = ?
         )`,
        [date]
    );
    return rows;
};

const getOwnerId = async (conn) => {
    const connection = conn || db;
    const [rows] = await connection.execute(`SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`);
    return rows.length > 0 ? rows[0].id : null;
};

module.exports = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    checkRecentUnusualActivityAlert,
    countRecentTransactions,
    getClosingPending,
    getOwnerId
};
