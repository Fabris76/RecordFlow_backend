const db = require('../config/database');

const create = async (conn, { userId, action, entityType, entityId, description, metadata = null }) => {
    const connection = conn || db;
    const [result] = await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, action, entityType, entityId || null, description, metadata ? JSON.stringify(metadata) : null]
    );
    return result.insertId;
};

module.exports = { create };

const list = async ({ action, entityType, startDate, endDate, page = 1, limit = 25 } = {}) => {
    const conditions = ['1 = 1'];
    const params = [];
    if (action) { conditions.push('al.action = ?'); params.push(String(action)); }
    if (entityType) { conditions.push('al.entity_type = ?'); params.push(String(entityType)); }
    if (startDate) { conditions.push('DATE(al.created_at) >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('DATE(al.created_at) <= ?'); params.push(endDate); }
    const offset = (Number(page) - 1) * Number(limit);
    const where = conditions.join(' AND ');
    const [rows] = await db.execute(
        `SELECT al.id, al.user_id, u.name AS user_name, al.action, al.entity_type, al.entity_id,
                al.description, al.metadata, al.created_at
         FROM audit_logs al JOIN users u ON u.id = al.user_id
         WHERE ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
    );
    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM audit_logs al WHERE ${where}`, params);
    return { rows, total: Number(countRows[0]?.total || 0) };
};

module.exports.list = list;