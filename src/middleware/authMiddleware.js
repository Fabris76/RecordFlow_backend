const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

        const [rows] = await db.execute(
            'SELECT id, role, status FROM users WHERE id = ? LIMIT 1',
            [decoded.id]
        );
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact the business owner.'
            });
        }

        req.user = { ...decoded, id: user.id, role: user.role, status: user.status };
        return next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({
                success: false,
                message: role === 'OWNER' ? 'Owner access required' : `${role} access required`
            });
        }
        return next();
    };
};

module.exports = {
    authenticateToken,
    requireRole
};
