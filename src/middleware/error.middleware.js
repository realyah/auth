// 404 Route Not Found middleware
const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Route not found' });
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Unhandled application error:', err);
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error'
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
