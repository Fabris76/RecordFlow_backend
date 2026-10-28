const express = require('express');
const router = express.Router();
const balancesController = require('../controllers/balancesController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { sensitiveRateLimiter } = require('../middleware/rateLimit');

router.get('/me', authenticateToken, requireRole('VENDOR'), balancesController.getOwnBalance);
router.get('/me/history', authenticateToken, requireRole('VENDOR'), balancesController.getOwnBalanceHistory);
router.get('/summary', authenticateToken, requireRole('OWNER'), balancesController.getOwnerBalanceSummary);
router.get('/owner-funds', authenticateToken, requireRole('OWNER'), balancesController.getOwnerFunds);
router.post('/owner-funds/add', authenticateToken, requireRole('OWNER'), sensitiveRateLimiter, balancesController.addOwnerFunds);
router.get('/', authenticateToken, requireRole('OWNER'), balancesController.getAllBalances);
router.get('/:vendorId', authenticateToken, requireRole('OWNER'), balancesController.getVendorBalance);
router.post('/:vendorId/allocate', authenticateToken, requireRole('OWNER'), sensitiveRateLimiter, balancesController.allocateOwnerFunds);
router.post('/:vendorId/adjust', authenticateToken, requireRole('OWNER'), sensitiveRateLimiter, balancesController.adjustBalance);

module.exports = router;
