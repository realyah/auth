const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { redisClient } = require('../config/redis');
const {
  SESSION_SECRET,
  SESSION_COOKIE_NAME,
  COOKIE_SECURE,
  SESSION_IDLE_TIMEOUT_MS,
} = require('../config');

const cookieOptions = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'strict',
  path: '/', // required by the __Host- prefix (no Domain attribute is set)
};

// Sessions live in Redis; the in-memory store is only used when REDIS_URL is unset
// (config refuses that in production).
const store = redisClient
  ? new RedisStore({ client: redisClient, prefix: 'sess:' })
  : undefined;

const sessionMiddleware = session({
  name: SESSION_COOKIE_NAME,
  secret: SESSION_SECRET,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true, // every response pushes the idle expiry forward
  unset: 'destroy',
  cookie: { ...cookieOptions, maxAge: SESSION_IDLE_TIMEOUT_MS },
});

// Promise wrappers around the callback-based session API
const regenerateSession = (req) =>
  new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));

const saveSession = (req) =>
  new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

const destroySession = (req, res) =>
  new Promise((resolve) => {
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    if (!req.session) return resolve();
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
      resolve();
    });
  });

module.exports = {
  sessionMiddleware,
  regenerateSession,
  saveSession,
  destroySession,
};
