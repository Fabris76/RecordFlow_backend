const notificationModel = require('../models/notificationModel');

const NOTIFICATION_TYPES = Object.freeze([
    'VENDOR_CREATED',
    'VENDOR_ACTIVATED',
    'VENDOR_DEACTIVATED',
    'TRANSACTION_EDITED',
    'LARGE_TRANSACTION',
    'BALANCE_ADJUSTED',
    'DAILY_CLOSING_COMPLETED',
    'CLOSING_PENDING',
    'UNUSUAL_ACTIVITY'
]);

const normalizeType = (type) => {
    if (typeof type !== 'string') return '';
    return type.trim().toUpperCase();
};

const isValidType = (type) => NOTIFICATION_TYPES.includes(normalizeType(type));

const getLargeTransactionThreshold = () => {
    const configured = Number(process.env.LARGE_TRANSACTION_THRESHOLD);
    return Number.isFinite(configured) && configured > 0 ? configured : 5000;
};

const create = async (conn, { recipientId, type, title, message, entityType = null, entityId = null }) => {
    const normalizedType = normalizeType(type);
    if (!isValidType(normalizedType)) {
        throw new Error(`Invalid notification type: ${type}`);
    }

    return notificationModel.createNotification(conn, {
        recipientId,
        type: normalizedType,
        title: String(title).trim(),
        message: String(message).trim(),
        entityType,
        entityId
    });
};

const notifyOwner = async (conn, type, title, message, entityType = null, entityId = null) => {
    const ownerId = await notificationModel.getOwnerId(conn);
    if (!ownerId) return null;

    return create(conn, {
        recipientId: ownerId,
        type,
        title,
        message,
        entityType,
        entityId
    });
};

const checkAndNotifyUnusualActivity = async (conn, vendorId, vendorName) => {
    const txCount = await notificationModel.countRecentTransactions(conn, vendorId);
    if (txCount > 20) {
        const alreadyNotified = await notificationModel.checkRecentUnusualActivityAlert(conn, vendorId);
        if (!alreadyNotified) {
            await notifyOwner(
                conn,
                'UNUSUAL_ACTIVITY',
                'Unusual Transaction Activity',
                `${vendorName} recorded more than 20 transactions within 10 minutes.`,
                'VENDOR',
                vendorId
            );
        }
    }
};

module.exports = {
    NOTIFICATION_TYPES,
    normalizeType,
    isValidType,
    getLargeTransactionThreshold,
    create,
    notifyOwner,
    checkAndNotifyUnusualActivity
};
