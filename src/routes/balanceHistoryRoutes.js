const express = require('express');
const router = express.Router();
const balancesController = require('../controllers/balancesController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, requireRole('OWNER'), balancesController.getAllBalanceHistory);

module.exports = router;
