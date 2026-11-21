const helmet = require('helmet');
const { FORCE_HTTPS } = require('../config');

// Security headers. This server only returns JSON and images, so the CSP denies
// everything: nothing it serves may run scripts, load resources or be framed.
const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"], // clickjacking
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true }, // 2 years
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  // The frontend is expected to be same-site (e.g. app.example.com + api.example.com)
  crossOriginResourcePolicy: { policy: 'same-site' },
});

// Refuse plain HTTP. Behind a TLS-terminating proxy set TRUST_PROXY so req.secure
// reflects X-Forwarded-Proto.
const requireHttps = (req, res, next) => {
  if (!FORCE_HTTPS || req.secure) return next();
  return res.status(403).json({ error: 'HTTPS is required' });
};

// API responses (especially auth ones) must never be cached by browsers or proxies
const noStore = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

module.exports = { securityHeaders, requireHttps, noStore };
