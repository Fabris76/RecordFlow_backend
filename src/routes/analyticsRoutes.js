const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/vendor-dashboard', authenticateToken, requireRole('VENDOR'), analyticsController.getVendorDashboard);
router.use(authenticateToken, requireRole('OWNER'));
router.get('/dashboard', analyticsController.getDashboard);
router.get('/vendor-performance', analyticsController.getVendorPerformance);
router.get('/transaction-types', analyticsController.getTransactionTypes);
router.get('/transaction-trend', analyticsController.getTransactionTrend);
router.get('/comparison', analyticsController.getComparison);
router.get('/activity-summary', analyticsController.getActivitySummary);
router.get('/large-transactions', analyticsController.getLargeTransactions);
router.get('/transaction-edits', analyticsController.getTransactionEdits);

module.exports = router;