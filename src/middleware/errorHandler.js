const errorHandler = (error, req, res, next) => {
    if (res.headersSent) return next(error);

    const requestId = req.requestId;
    console.error('Unhandled request error:', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        userId: req.user?.id,
        message: error?.message
    });

    if (error?.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Request body is too large', request_id: requestId });
    }
    if (error instanceof SyntaxError && error.status === 400 && error.body) {
        return res.status(400).json({ success: false, message: 'Invalid JSON body', request_id: requestId });
    }
    return res.status(error?.statusCode || error?.status || 500).json({
        success: false,
        message: error?.statusCode || error?.status ? error.message : 'An internal server error occurred',
        request_id: requestId
    });
};

module.exports = errorHandler;