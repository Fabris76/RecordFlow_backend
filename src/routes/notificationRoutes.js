const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.use(authenticateToken, requireRole('OWNER'));

router.get('/unread/count', notificationController.getUnreadCount);
router.get('/unread', notificationController.getUnreadNotifications);
router.get('/closing-pending', notificationController.getClosingPending);
router.patch('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.patch('/:id/read', notificationController.markAsRead);
router.get('/', notificationController.getNotifications);

module.exports = router;
