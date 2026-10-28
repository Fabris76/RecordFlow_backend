const crypto = require('crypto');

const requestContext = (req, res, next) => {
    const supplied = req.get('X-Request-ID');
    const requestId = supplied && /^[A-Za-z0-9._-]{1,100}$/.test(supplied)
        ? supplied
        : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
};

module.exports = requestContext;