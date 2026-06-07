// middleware/errorHandler.js — centralised error handling
'use strict';

const isDev = process.env.NODE_ENV !== 'production';

/** Ensure API routes always return JSON, never HTML. */
function apiJsonHeader(req, res, next) {
    if (req.path.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
    }
    next();
}

/** Catch JSON syntax errors on API routes. */
function apiJsonSyntaxError(err, req, res, next) {
    if (req.path.startsWith('/api/') && err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }
    next(err);
}

/** Catch-all error handler for API routes — never renders HTML. */
function apiErrorHandler(err, req, res, next) {
    if (req.path.startsWith('/api/')) {
        console.error(`[API Error] ${req.method} ${req.path}:`, err.message);
        if (isDev) console.error(err.stack);
        return res.status(err.status || 500).json({
            success: false,
            message: isDev ? err.message : 'Internal server error',
        });
    }
    next(err);
}

/** 404 handler for API routes. */
function apiNotFound(req, res, next) {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
        });
    }
    next();
}

/** Generic 404 for web routes — renders the 404 view. */
function notFound(req, res) {
    res.status(404).render('404', {
        title:   'Page Not Found',
        message: 'The page you are looking for does not exist.',
    });
}

/** Global error handler for web routes. */
function globalErrorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
    console.error('[Global Error]', err.stack);
    res.status(500).render('error', {
        title:   'Server Error',
        message: isDev ? err.message : 'Something went wrong. Please try again later.',
        stack:   isDev ? err.stack   : null,
    });
}

module.exports = {
    apiJsonHeader,
    apiJsonSyntaxError,
    apiErrorHandler,
    apiNotFound,
    notFound,
    globalErrorHandler,
};
