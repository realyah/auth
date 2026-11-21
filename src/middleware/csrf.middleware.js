const { randomToken, safeEqual } = require('../utils/crypto');
const { logSecurityEvent } = require('../utils/securityLogger');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

// Synchronizer-token pattern: one random token per session, which the frontend
// sends back in the X-CSRF-Token header on every state-changing request.
const getCsrfToken = (req) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomToken();
  }
  return req.session.csrfToken;
};

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const sent = req.get(CSRF_HEADER);
  if (!req.session?.csrfToken || !safeEqual(sent, req.session.csrfToken)) {
    logSecurityEvent('csrf.rejected', { req, method: req.method });
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
};

module.exports = { csrfProtection, getCsrfToken, CSRF_HEADER };
