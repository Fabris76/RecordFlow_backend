const db = require('../config/database');

const createVendor = async (userId) => {
    const [result] = await db.execute(
        'INSERT INTO vendors (user_id) VALUES (?)',
        [userId]
    );
    return result;
};

const createUserWithTransaction = async (conn, name, phone, hashedPassword) => {
    const [result] = await conn.execute(
        'INSERT INTO users (name, phone, password, role, status) VALUES (?, ?, ?, ?, ?)',
        [name, phone, hashedPassword, 'VENDOR', 'ACTIVE']
    );
    return result;
};

const createVendorWithTransaction = async (conn, userId) => {
    const [result] = await conn.execute(
        'INSERT INTO vendors (user_id) VALUES (?)',
        [userId]
    );
    return result;
};

const phoneExistsWithTransaction = async (conn, phone) => {
    const [rows] = await conn.execute(
        'SELECT id FROM users WHERE phone = ? LIMIT 1',
        [phone]
    );
    return rows.length > 0;
};

const getAllVendors = async (filters = {}) => {
    const { status, search } = filters;
    const conditions = ["u.role = 'VENDOR'"];
    const params = [];

    if (status) {
        conditions.push('u.status = ?');
        params.push(String(status).toUpperCase());
    }

    if (search) {
        conditions.push('(u.name LIKE ? OR u.phone LIKE ?)');
        const term = `%${search}%`;
        params.push(term, term);
    }

    const where = conditions.join(' AND ');
    const query = `
        SELECT
            v.id AS vendor_id,
            u.id AS user_id,
            u.name,
            u.phone,
            u.role,
            u.status,
            v.created_at,
            v.updated_at
        FROM vendors v
        JOIN users u ON v.user_id = u.id
        WHERE ${where}
        ORDER BY v.created_at DESC
    `;

    const [rows] = await db.execute(query, params);
    return rows;
};

const getVendorById = async (id) => {
    const query = `
        SELECT
            v.id AS vendor_id,
            u.id AS user_id,
            u.name,
            u.phone,
            u.role,
            u.status,
            v.created_at,
            v.updated_at
        FROM vendors v
        JOIN users u ON v.user_id = u.id
        WHERE u.id = ? AND u.role = 'VENDOR'
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [id]);
    return rows[0];
};

const getVendorByUserId = async (userId) => {
    const query = `
        SELECT
            v.id AS vendor_id,
            u.id AS user_id,
            u.name,
            u.phone,
            u.role,
            u.status,
            v.created_at,
            v.updated_at
        FROM vendors v
        JOIN users u ON v.user_id = u.id
        WHERE u.id = ? AND u.role = 'VENDOR'
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [userId]);
    return rows[0];
};

const updateUserStatus = async (userId, status, conn = null) => {
    const connection = conn || db;
    const [result] = await connection.execute(
        "UPDATE users SET status = ? WHERE id = ? AND role = 'VENDOR'",
        [status, userId]
    );
    return result;
};

const deleteAllVendors = async (conn) => {
    const [vendorRows] = await conn.execute(
        "SELECT id FROM users WHERE role = 'VENDOR' FOR UPDATE"
    );
    const vendorIds = vendorRows.map((vendor) => vendor.id);

    if (vendorIds.length === 0) {
        return 0;
    }

    const placeholders = vendorIds.map(() => '?').join(', ');
    await conn.execute(
        `DELETE FROM transaction_history
         WHERE changed_by IN (${placeholders})
            OR transaction_id IN (
                SELECT id FROM transactions WHERE vendor_id IN (${placeholders})
            )`,
        [...vendorIds, ...vendorIds]
    );
    await conn.execute(
        `DELETE FROM transactions WHERE vendor_id IN (${placeholders})`,
        vendorIds
    );
    await conn.execute(
        `DELETE FROM balance_history WHERE vendor_id IN (${placeholders}) OR changed_by IN (${placeholders})`,
        [...vendorIds, ...vendorIds]
    );
    await conn.execute(
        `DELETE FROM audit_logs
         WHERE user_id IN (${placeholders})
            OR (entity_type = 'VENDOR' AND entity_id IN (${placeholders}))`,
        [...vendorIds, ...vendorIds]
    );
    await conn.execute(
        `DELETE FROM notifications
         WHERE recipient_id IN (${placeholders})
            OR (entity_type = 'VENDOR' AND entity_id IN (${placeholders}))`,
        [...vendorIds, ...vendorIds]
    );
    await conn.execute(
        `DELETE FROM users WHERE id IN (${placeholders})`,
        vendorIds
    );

    return vendorIds.length;
};

const updateVendorProfile = async (userId, vendorId, { name, phone }) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute(
            'UPDATE users SET name = ?, phone = ? WHERE id = ? AND role = ?',
            [name, phone, userId, 'VENDOR']
        );
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = {
    createVendor,
    createUserWithTransaction,
    createVendorWithTransaction,
    phoneExistsWithTransaction,
    getAllVendors,
    getVendorById,
    getVendorByUserId,
    updateUserStatus,
    deleteAllVendors,
    updateVendorProfile
};
