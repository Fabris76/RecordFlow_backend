const reconciliationModel = require('../models/reconciliationModel');

const isValidDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const localDate = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getDate = (value) => value || localDate();

const getMyReconciliation = async (req, res) => {
    try {
        const businessDate = getDate(req.query.date);
        if (!isValidDate(businessDate)) {
            return res.status(422).json({ success: false, message: 'Invalid business date' });
        }

        const data = await reconciliationModel.getForVendorDate(req.user.id, businessDate);
        if (!data) return res.status(404).json({ success: false, message: 'Reconciliation data not found' });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get vendor reconciliation error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getOwnerReconciliation = async (req, res) => {
    try {
        const businessDate = getDate(req.query.date);
        if (!isValidDate(businessDate)) {
            return res.status(422).json({ success: false, message: 'Invalid business date' });
        }

        let vendorId;
        if (req.query.vendor_id !== undefined) {
            vendorId = Number(req.query.vendor_id);
            if (!Number.isInteger(vendorId) || vendorId <= 0) {
                return res.status(422).json({ success: false, message: 'Invalid vendor ID' });
            }
        }

        const data = await reconciliationModel.getForOwner(businessDate, vendorId);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get owner reconciliation error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = { getMyReconciliation, getOwnerReconciliation };