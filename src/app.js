const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const { TRUST_PROXY, CORS_ORIGIN } = require('./config');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY);

// Global middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Application routes
app.use('/', routes);

// 404 route handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
