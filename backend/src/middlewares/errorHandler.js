const ApiError = require('../utils/ApiError');

// Express error-handling middleware (must have 4 parameters)
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    const payload = { message: err.message };
    if (err.details !== null && err.details !== undefined) {
      payload.details = err.details;
    }
    return res.status(err.statusCode).json(payload);
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      message: 'Malformed JSON payload in request body',
    });
  }

  // Handle unique constraint violation from pg
  if (err.code === '23505') {
    return res.status(409).json({
      message: 'Conflict: A record with this unique value already exists',
    });
  }

  // Handle foreign key constraint violation from pg
  if (err.code === '23503') {
    return res.status(400).json({
      message: 'Referenced entity does not exist',
    });
  }

  // Log unexpected errors server-side without leaking stack trace to client
  console.error('Unhandled server error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  return res.status(500).json({
    message: 'Internal server error',
  });
};

module.exports = errorHandler;
