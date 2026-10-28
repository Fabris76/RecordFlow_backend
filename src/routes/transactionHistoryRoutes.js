const express = require('express');
const router = express.Router();
const transactionHistoryController = require('../controllers/transactionHistoryController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, requireRole('OWNER'), transactionHistoryController.getAllTransactionHistory);
router.get('/:id/history', authenticateToken, transactionHistoryController.getTransactionHistory);

module.exports = router;
