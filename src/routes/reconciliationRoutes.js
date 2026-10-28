const express = require('express');
const reconciliationController = require('../controllers/reconciliationController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/me', authenticateToken, requireRole('VENDOR'), reconciliationController.getMyReconciliation);
router.get('/', authenticateToken, requireRole('OWNER'), reconciliationController.getOwnerReconciliation);

module.exports = router;