const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

// Authentication middleware: expects "Authorization: Bearer <token>"
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!token || !/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, payload) => {
    if (err || !payload || typeof payload.username !== 'string') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = payload;
    next();
  });
};

module.exports = {
  authenticateToken
};
