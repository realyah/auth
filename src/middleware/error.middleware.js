// 404 Route Not Found middleware
const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Route not found' });
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  // Malformed JSON body sent by the client
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
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
