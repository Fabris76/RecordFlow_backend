require('dotenv').config();
const mysql = require('mysql2/promise');

const ensureIndex = async (connection, tableName, indexName, addIndexSql) => {
    const [indexes] = await connection.query(
        `SHOW INDEX FROM ${tableName} WHERE Key_name = ?`,
        [indexName]
    );

    if (indexes.length === 0) {
        await connection.query(addIndexSql);
    }
};

const runMigration = async () => {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 3306,
            multipleStatements: true
        });
        console.log('Running migration...');

        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME};`);
        await connection.query(`USE ${process.env.DB_NAME};`);

        const [auditTables] = await connection.query(
            `SHOW TABLES LIKE 'vendor_audit'`
        );
        if (auditTables.length > 0) {
            await connection.query('DROP TABLE vendor_audit');
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('OWNER', 'VENDOR') NOT NULL DEFAULT 'VENDOR',
                status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (phone)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS vendors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY (user_id)
            );
        `);

        const [vendorColumns] = await connection.query(
            `SHOW COLUMNS FROM vendors LIKE 'branch_id'`
        );
        if (vendorColumns.length > 0) {
            await connection.query('ALTER TABLE vendors DROP COLUMN branch_id');
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transaction_reference VARCHAR(50) UNIQUE,
                vendor_id INT NOT NULL,
                type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'AIRTIME', 'DATA', 'BILL_PAYMENT', 'OTHER') NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                customer_reference VARCHAR(100) NULL,
                transaction_date DATE NOT NULL,
                transaction_time TIME NOT NULL,
                status ENUM('COMPLETED', 'PENDING', 'FAILED') NOT NULL DEFAULT 'COMPLETED',
                idempotency_key VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (vendor_id) REFERENCES users(id),
                INDEX idx_transactions_vendor_date (vendor_id, transaction_date),
                INDEX idx_transactions_type_status (type, status),
                INDEX idx_transactions_created_at (created_at),
                INDEX idx_transactions_amount (amount),
                INDEX idx_transactions_transaction_reference (transaction_reference),
                UNIQUE KEY unique_transaction_idempotency (vendor_id, idempotency_key)
            );
        `);

        const [transactionColumns] = await connection.query(
            `SHOW COLUMNS FROM transactions LIKE 'idempotency_key'`
        );
        if (transactionColumns.length === 0) {
            await connection.query(
                'ALTER TABLE transactions ADD COLUMN idempotency_key VARCHAR(100) NULL'
            );
        }
        await ensureIndex(
            connection,
            'transactions',
            'unique_transaction_idempotency',
            'ALTER TABLE transactions ADD UNIQUE KEY unique_transaction_idempotency (vendor_id, idempotency_key)'
        );

        await connection.query(`
            CREATE TABLE IF NOT EXISTS transaction_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transaction_id INT NOT NULL,
                field_name VARCHAR(100) NOT NULL,
                old_value TEXT NULL,
                new_value TEXT NULL,
                changed_by INT NOT NULL,
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (transaction_id) REFERENCES transactions(id),
                FOREIGN KEY (changed_by) REFERENCES users(id),
                INDEX idx_history_transaction (transaction_id, changed_at),
                INDEX idx_history_changed_by (changed_by)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS daily_closing (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_id INT NOT NULL,
                closing_date DATE NOT NULL,
                total_transactions INT NOT NULL DEFAULT 0,
                total_deposits DECIMAL(12,2) DEFAULT 0,
                total_withdrawals DECIMAL(12,2) DEFAULT 0,
                total_transfers DECIMAL(12,2) DEFAULT 0,
                total_airtime DECIMAL(12,2) DEFAULT 0,
                total_data DECIMAL(12,2) DEFAULT 0,
                total_bill_payments DECIMAL(12,2) DEFAULT 0,
                total_other DECIMAL(12,2) DEFAULT 0,
                total_amount DECIMAL(12,2) DEFAULT 0,
                status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
                closed_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_closing (vendor_id, closing_date),
                INDEX idx_closing_vendor_date (vendor_id, closing_date),
                INDEX idx_closing_status (status)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS vendor_balances (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_id INT NOT NULL,
                cash_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                momo_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_vendor_balance (vendor_id)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS owner_balances (
                id TINYINT PRIMARY KEY,
                cash_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                momo_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        await connection.query(
            'INSERT IGNORE INTO owner_balances (id, cash_balance, momo_balance) VALUES (1, 0.00, 0.00)'
        );

        await connection.query(`
            CREATE TABLE IF NOT EXISTS balance_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_id INT NOT NULL,
                balance_type ENUM('CASH', 'MOMO') NOT NULL,
                change_amount DECIMAL(12,2) NOT NULL,
                previous_balance DECIMAL(12,2) NOT NULL,
                new_balance DECIMAL(12,2) NOT NULL,
                reason VARCHAR(255) NOT NULL,
                reference_type VARCHAR(50),
                reference_id INT,
                changed_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (changed_by) REFERENCES users(id),
                INDEX idx_history_vendor (vendor_id),
                INDEX idx_history_type (balance_type),
                INDEX idx_history_date (created_at)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recipient_id INT NOT NULL,
                type VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message VARCHAR(500) NOT NULL,
                entity_type VARCHAR(50) NULL,
                entity_id INT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL,
                FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_notifications_recipient (recipient_id, created_at),
                INDEX idx_notifications_is_read (is_read),
                INDEX idx_notifications_type (type),
                INDEX idx_notifications_created_at (created_at),
                INDEX idx_notifications_entity (entity_type, entity_id)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT NULL,
                description VARCHAR(500) NOT NULL,
                metadata JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                INDEX idx_audit_user (user_id),
                INDEX idx_audit_action (action),
                INDEX idx_audit_entity (entity_type, entity_id),
                INDEX idx_audit_created_at (created_at)
            );
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS backups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                file_size BIGINT NOT NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(30) NOT NULL,
                FOREIGN KEY (created_by) REFERENCES users(id),
                UNIQUE KEY unique_backup_filename (filename),
                INDEX idx_backups_created_at (created_at),
                INDEX idx_backups_status (status)
            );
        `);

        await ensureIndex(
            connection,
            'notifications',
            'idx_notifications_recipient',
            'ALTER TABLE notifications ADD INDEX idx_notifications_recipient (recipient_id, created_at)'
        );
        await ensureIndex(
            connection,
            'notifications',
            'idx_notifications_is_read',
            'ALTER TABLE notifications ADD INDEX idx_notifications_is_read (is_read)'
        );
        await ensureIndex(
            connection,
            'notifications',
            'idx_notifications_type',
            'ALTER TABLE notifications ADD INDEX idx_notifications_type (type)'
        );
        await ensureIndex(
            connection,
            'notifications',
            'idx_notifications_created_at',
            'ALTER TABLE notifications ADD INDEX idx_notifications_created_at (created_at)'
        );
        await ensureIndex(
            connection,
            'notifications',
            'idx_notifications_entity',
            'ALTER TABLE notifications ADD INDEX idx_notifications_entity (entity_type, entity_id)'
        );

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        if (connection) await connection.end();
    }
};

runMigration();
