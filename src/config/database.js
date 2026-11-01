
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const tidbHost = process.env.TIDB_HOST;
const databaseName =
    process.env.DB_NAME ||
    process.env.TIDB_DATABASE ||
    'recordflow_db';

// Load Aiven CA certificate when SSL is enabled
const sslEnabled =
    Boolean(tidbHost) ||
    process.env.TIDB_ENABLE_SSL === 'true';

const sslConfig = sslEnabled
    ? {
        ca: fs.readFileSync(
            path.resolve(__dirname, '../../certs/ca.pem'),
            'utf8'
        ),
        minVersion: 'TLSv1.2'
    }
    : undefined;

const pool = mysql.createPool({
    host: process.env.DB_HOST || tidbHost || 'localhost',
    user: process.env.DB_USER || process.env.TIDB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.TIDB_PASSWORD || '',
    database: databaseName,
    port: Number(process.env.DB_PORT || process.env.TIDB_PORT || 3306),

    ...(sslConfig ? { ssl: sslConfig } : {}),

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
