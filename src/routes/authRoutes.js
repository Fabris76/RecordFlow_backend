const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { loginRateLimiter } = require('../middleware/rateLimit');

router.post('/register', authController.register);
router.post('/login', loginRateLimiter, authController.login);
router.get('/me', authenticateToken, authController.getMe);

// Protected route for OWNER
router.get('/owner-only', authenticateToken, requireRole('OWNER'), (req, res) => {
    res.json({ message: 'Welcome Owner!' });
});

// Protected route for VENDOR
router.get('/vendor-only', authenticateToken, requireRole('VENDOR'), (req, res) => {
    res.json({ message: 'Welcome Vendor!' });
});

module.exports = router;
