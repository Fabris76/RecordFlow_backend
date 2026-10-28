const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/me', authenticateToken, requireRole('VENDOR'), vendorController.getVendorMe);
router.use(authenticateToken);

router.post('/', requireRole('OWNER'), vendorController.createVendor);
router.delete('/all', requireRole('OWNER'), vendorController.deleteAllVendors);
router.get('/', requireRole('OWNER'), vendorController.getAllVendors);
router.get('/:id', requireRole('OWNER'), vendorController.getVendorById);
router.put('/:id', requireRole('OWNER'), vendorController.updateVendor);
router.patch('/:id/status', requireRole('OWNER'), vendorController.updateVendorStatus);
router.delete('/:id', requireRole('OWNER'), vendorController.deleteVendor);

module.exports = router;
