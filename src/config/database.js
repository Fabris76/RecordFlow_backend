
const mysql = require('mysql2/promise');
require('dotenv').config();

const tidbHost = process.env.TIDB_HOST;
const databaseName = process.env.DB_NAME || process.env.TIDB_DATABASE || 'momo_business_db';

const pool = mysql.createPool({
    host: process.env.DB_HOST || tidbHost || 'localhost',
    user: process.env.DB_USER || process.env.TIDB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.TIDB_PASSWORD || '',
    database: databaseName,
    port: Number(process.env.DB_PORT || process.env.TIDB_PORT || 3306),
    ...(tidbHost || process.env.TIDB_ENABLE_SSL === 'true'
        ? { ssl: { minVersion: 'TLSv1.2' } }
        : {}),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
