// 404 Route Not Found middleware
const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Route not found' });
};

// Global error handling middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Malformed JSON body sent by the client
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  // Mongoose validation / cast errors are client errors
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message });
  }

  const statusCode = err.status || err.statusCode || 500;
  if (statusCode >= 500) {
    console.error('Unhandled application error:', err);
  }
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.message
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
