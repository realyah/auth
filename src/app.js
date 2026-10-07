const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Application routes
app.use('/', routes);

// 404 route handler
app.use('*', notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
