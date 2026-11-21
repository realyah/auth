const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const { securityHeaders, requireHttps, noStore } = require('./middleware/security.middleware');
const { sessionMiddleware } = require('./middleware/session.middleware');
const { csrfProtection, CSRF_HEADER } = require('./middleware/csrf.middleware');
const { TRUST_PROXY, CORS_ORIGIN, UPLOAD_DIR } = require('./config');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY);

// Transport + headers: HTTPS only, Helmet (CSP, HSTS, frame denial, nosniff, ...)
app.use(requireHttps);
app.use(securityHeaders);

// Cookies are sent cross-origin only to the listed frontend origins
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', CSRF_HEADER],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  maxAge: 600,
}));

// JSON bodies only, small limit (file uploads go through multer with their own limit)
app.use(express.json({ limit: '10kb', strict: true }));

// Uploaded profile pictures, e.g. GET /uploads/avatars/<file>.png
app.use(
  '/uploads/avatars',
  express.static(path.join(UPLOAD_DIR, 'avatars'), {
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
  })
);

// API: sessions, CSRF on every state-changing request, never cached
app.use('/api', noStore, sessionMiddleware, csrfProtection);

// Application routes
app.use('/', routes);

// 404 route handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
