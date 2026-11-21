const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisClient } = require('../config/redis');
const { logSecurityEvent } = require('../utils/securityLogger');
const { LOGIN_RATE_LIMIT_WINDOW_MS, LOGIN_RATE_LIMIT_MAX } = require('../config');

// Per-IP limiter for authentication endpoints. Counters live in Redis when
// available so the limit holds across restarts and multiple server instances.
const createAuthLimiter = ({ name, windowMs = LOGIN_RATE_LIMIT_WINDOW_MS, max = LOGIN_RATE_LIMIT_MAX } = {}) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: redisClient
      ? new RedisStore({
          prefix: `rl:${name}:`,
          sendCommand: (...args) => redisClient.sendCommand(args),
        })
      : undefined,
    handler: (req, res, next, options) => {
      logSecurityEvent('rate_limit.exceeded', { req, limiter: name });
      res.status(options.statusCode).json({
        error: 'Too many attempts, please try again later',
      });
    },
  });

const loginLimiter = createAuthLimiter({ name: 'login' });
const registerLimiter = createAuthLimiter({ name: 'register' });
const mfaLimiter = createAuthLimiter({ name: 'mfa' });

module.exports = { createAuthLimiter, loginLimiter, registerLimiter, mfaLimiter };
