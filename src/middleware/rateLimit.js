const buckets = new Map();

const createRateLimiter = ({ windowMs = 60_000, max = 100, message = 'Too many requests' } = {}) => {
    return (req, res, next) => {
        const key = `${req.ip}:${req.baseUrl || ''}:${req.path || ''}`;
        const now = Date.now();
        const current = buckets.get(key);
        if (!current || now >= current.resetAt) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (current.count >= max) {
            res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
            return res.status(429).json({ success: false, message });
        }
        current.count += 1;
        return next();
    };
};

const apiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10, message: 'Too many login attempts. Please try again later.' });
const sensitiveRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

module.exports = { createRateLimiter, apiRateLimiter, loginRateLimiter, sensitiveRateLimiter };