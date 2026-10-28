const express = require('express');
const backupController = require('../controllers/backupController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { sensitiveRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER'));
router.post('/', sensitiveRateLimiter, backupController.createBackup);
router.get('/', backupController.listBackups);
router.get('/:id/download', backupController.downloadBackup);
router.post('/:id/restore', sensitiveRateLimiter, backupController.restoreBackup);

module.exports = router;