const express = require('express');
const auditController = require('../controllers/auditController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/', authenticateToken, requireRole('OWNER'), auditController.listAuditLogs);
module.exports = router;
