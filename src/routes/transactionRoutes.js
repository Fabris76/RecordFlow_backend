const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const transactionHistoryController = require('../controllers/transactionHistoryController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { sensitiveRateLimiter } = require('../middleware/rateLimit');

router.post('/', authenticateToken, requireRole('VENDOR'), sensitiveRateLimiter, transactionController.createTransaction);
router.get('/my', authenticateToken, requireRole('VENDOR'), transactionController.getTransactions);
router.get('/', authenticateToken, transactionController.getTransactions);
router.put('/:id', authenticateToken, transactionController.updateTransaction);
router.get('/:id/history', authenticateToken, transactionHistoryController.getTransactionHistory);
router.get('/:id', authenticateToken, transactionController.getTransactionById);

module.exports = router;
