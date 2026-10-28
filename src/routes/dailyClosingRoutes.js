const express = require('express');
const router = express.Router();
const dailyClosingController = require('../controllers/dailyClosingController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, requireRole('VENDOR'), dailyClosingController.createClosing);
router.get('/today', authenticateToken, requireRole('VENDOR'), dailyClosingController.getTodayStatus);
router.get('/my', authenticateToken, requireRole('VENDOR'), dailyClosingController.getMyClosings);
router.get('/', authenticateToken, requireRole('OWNER'), dailyClosingController.getAllClosings);
router.get('/:id', authenticateToken, dailyClosingController.getClosingById);
router.post('/:id/reopen', authenticateToken, requireRole('OWNER'), dailyClosingController.reopenClosing);

module.exports = router;
