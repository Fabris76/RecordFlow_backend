const db = require('../config/database');

const get = async () => {
    const [rows] = await db.execute('SELECT * FROM owner_balances WHERE id = 1');
    return rows[0];
};

const getForUpdate = async (conn) => {
    const [rows] = await conn.execute('SELECT * FROM owner_balances WHERE id = 1 FOR UPDATE');
    return rows[0];
};

const updateBalance = async (conn, balanceType, amount) => {
    const column = balanceType === 'CASH' ? 'cash_balance' : 'momo_balance';
    await conn.execute(
        `UPDATE owner_balances SET ${column} = ${column} + ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        [amount]
    );
};

module.exports = { get, getForUpdate, updateBalance };
