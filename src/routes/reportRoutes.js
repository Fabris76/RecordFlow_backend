const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole('OWNER'));

router.get('/daily', reportController.getDailyReport);
router.get('/weekly', reportController.getWeeklyReport);
router.get('/monthly', reportController.getMonthlyReport);
router.get('/transaction-types', reportController.getTransactionTypesSummary);
router.get('/vendors', reportController.getVendorPerformance);


router.get('/daily-trend', reportController.getDailyTrendReport);
router.get('/closing', reportController.getClosingReport);
module.exports = router;

