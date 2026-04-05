/**
 * Global Express error handler.
 * Must be registered as the last middleware with 4 parameters.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[ErrorHandler]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const errors = err.errors || [];

  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}

module.exports = errorHandler;
