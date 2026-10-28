const db = require('../config/database');

const createUser = async (name, phone, hashedPassword, role, status = 'ACTIVE') => {
    const [result] = await db.execute(
        'INSERT INTO users (name, phone, password, role, status) VALUES (?, ?, ?, ?, ?)',
        [name, phone, hashedPassword, role, status]
    );
    return result;
};

const getUserByPhone = async (phone) => {
    const [rows] = await db.execute(
        'SELECT * FROM users WHERE phone = ?',
        [phone]
    );
    return rows[0];
};

const getUserById = async (id) => {
    const [rows] = await db.execute(
        'SELECT id, name, phone, role, status, created_at, updated_at FROM users WHERE id = ?',
        [id]
    );
    return rows[0];
};

module.exports = {
    createUser,
    getUserByPhone,
    getUserById
};

