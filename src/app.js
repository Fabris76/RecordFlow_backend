const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/database');

const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const transactionHistoryRoutes = require('./routes/transactionHistoryRoutes');
const dailyClosingRoutes = require('./routes/dailyClosingRoutes');
const balancesRoutes = require('./routes/balancesRoutes');
const balanceHistoryRoutes = require('./routes/balanceHistoryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const backupRoutes = require('./routes/backupRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reconciliationRoutes = require('./routes/reconciliationRoutes');
const auditRoutes = require('./routes/auditRoutes');

const requestContext = require('./middleware/requestContext');
const errorHandler = require('./middleware/errorHandler');
const { apiRateLimiter } = require('./middleware/rateLimit');

const app = express();

app.use(helmet());

const allowedOrigins = [...new Set([
    'https://recordflowfrontend.vercel.app',
    ...(process.env.FRONTEND_URL || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
])];

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: allowedOrigins.length > 0
}));

app.use(requestContext);
app.use(express.json({ limit: '100kb' }));
app.use('/api', apiRateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transaction-history', transactionHistoryRoutes);
app.use('/api/daily-closing', dailyClosingRoutes);
app.use('/api/balances', balancesRoutes);
app.use('/api/balance-history', balanceHistoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/audit', auditRoutes);

// Basic server health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running'
    });
});

// Database health check
app.get('/health/db', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT DATABASE() AS database_name'
        );

        res.status(200).json({
            status: 'OK',
            message: 'Database connection successful',
            database: rows[0].database_name
        });
    } catch (error) {
        console.error('Database health check failed:', error.message);

        res.status(503).json({
            status: 'ERROR',
            message: 'Database connection failed'
        });
    }
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        request_id: req.requestId
    });
});

// Error handler
app.use(errorHandler);

module.exports = app;
