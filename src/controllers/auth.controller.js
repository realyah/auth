const UAParser = require("ua-parser-js");
const User = require("../models/user.model");
const { hashPassword, verifyPassword, needsRehash, burnVerifyTime } = require("../utils/password");
const { logSecurityEvent } = require("../utils/securityLogger");
const { regenerateSession, saveSession, destroySession } = require("../middleware/session.middleware");
const { getCsrfToken } = require("../middleware/csrf.middleware");
const {
  MAX_FAILED_ATTEMPTS,
  LOCK_DURATION_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_ABSOLUTE_TIMEOUT_MS,
} = require("../config");

// One message for every login failure: wrong username, wrong password, locked
// account. Distinct messages would let attackers discover which usernames exist.
const INVALID_LOGIN = "Invalid username or password";

// Parse User-Agent header into structured browser, OS, and device info
const parseUserAgent = (uaHeader = "") => {
  const parsed = UAParser(uaHeader);
  const join = (part) => (part.name ? [part.name, part.version].filter(Boolean).join(" ") : "Unknown");
  return {
    browser: join(parsed.browser),
    os: join(parsed.os),
    deviceType: parsed.device.type || "desktop",
  };
};

// Client IP address. Uses req.ip, which honours X-Forwarded-For only when
// "trust proxy" is configured (see TRUST_PROXY), so clients cannot spoof it.
const getClientIp = (req) => {
  const rawIp = req.ip || req.socket?.remoteAddress || "";
  return rawIp.replace(/^::ffff:/, "").replace(/^::1$/, "127.0.0.1") || null;
};

// Record the outcome of a login attempt on the user document
const recordLoginAttempt = (req, user, status) => {
  const now = new Date();
  user.login_status = status;
  user.userAgentString = {
    ...parseUserAgent(req.headers["user-agent"]),
    ipAddress: getClientIp(req),
    loginStatus: status,
    loggedInAt: now,
  };
};

// Count a failed password attempt; locks the account at MAX_FAILED_ATTEMPTS
const registerFailedAttempt = (req, user) => {
  const now = new Date();
  // A lock that has expired starts the counter again from zero
  const previous = user.lock_until && user.lock_until <= now ? 0 : user.failed_login_attempts || 0;
  user.failed_login_attempts = previous + 1;

  if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
    user.lock_until = new Date(now.getTime() + LOCK_DURATION_MS);
    recordLoginAttempt(req, user, "LOCKED");
    logSecurityEvent("account.locked", { req, level: "error", userId: String(user._id), username: user.username });
  } else {
    recordLoginAttempt(req, user, "FAILED_PASSWORD");
  }
};

const isLocked = (user) => Boolean(user.lock_until && user.lock_until > new Date());

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
});

// Successful authentication: new session id (prevents session fixation), fresh
// CSRF token, timestamps for the idle and absolute timeouts.
const completeLogin = async (req, res, user) => {
  user.failed_login_attempts = 0;
  user.lock_until = null;
  recordLoginAttempt(req, user, "SUCCESS");
  await user.save();

  await regenerateSession(req);
  const now = Date.now();
  req.session.userId = String(user._id);
  req.session.authenticatedAt = now;
  req.session.lastSeenAt = now;
  const csrfToken = getCsrfToken(req);
  await saveSession(req);

  logSecurityEvent("login.success", { req, level: "info", userId: String(user._id), username: user.username });

  return res.json({
    message: "Login successful",
    status: "SUCCESS",
    csrfToken,
    user: publicUser(user),
    userAgent: user.userAgentString,
  });
};

// GET /api/auth/csrf-token — call once on app load and after logout
const csrfToken = (req, res) => {
  res.json({ csrfToken: getCsrfToken(req) });
};

// POST /api/auth/register
const registerUser = async (req, res, next) => {
  try {
    const { username, password } = req.validated.body;

    const existingUser = await User.exists({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const user = await User.create({ username, password: await hashPassword(password) });
    logSecurityEvent("user.registered", { req, level: "info", userId: String(user._id), username });

    res.status(201).json({
      message: "User registered successfully",
      user: { id: user._id, username: user.username, createdAt: user.createdAt },
    });
  } catch (error) {
    // Duplicate key from a concurrent registration with the same username
    if (error.code === 11000) {
      return res.status(409).json({ error: "Username already exists" });
    }
    next(error);
  }
};

// POST /api/auth/login
const loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.validated.body;
    const fail = (reason, extra = {}) => {
      logSecurityEvent("login.failed", { req, username, reason, ...extra });
      return res.status(401).json({ error: INVALID_LOGIN });
    };

    const user = await User.findOne({ username });
    if (!user) {
      await burnVerifyTime(password); // same timing as a real password check
      return fail("unknown_user");
    }

    // Always verify, even when locked, so all failure paths take the same time
    const passwordOk = await verifyPassword(user.password, password);

    if (isLocked(user)) {
      recordLoginAttempt(req, user, "LOCKED");
      await user.save();
      return fail("account_locked", { userId: String(user._id) });
    }

    if (!passwordOk) {
      registerFailedAttempt(req, user);
      await user.save();
      return fail("bad_password", { userId: String(user._id), failedAttempts: user.failed_login_attempts });
    }

    // Upgrade legacy bcrypt / weaker Argon2 hashes while we have the plaintext
    if (needsRehash(user.password)) {
      user.password = await hashPassword(password);
    }

    return completeLogin(req, res, user);
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
const logoutUser = async (req, res) => {
  const userId = req.session?.userId;
  await destroySession(req, res);
  if (userId) logSecurityEvent("logout", { req, level: "info", userId });
  res.json({ message: "Logged out successfully" });
};

// GET /api/auth/session — who is logged in and when the session ends
const getSession = (req, res) => {
  const { authenticatedAt, lastSeenAt } = req.session;
  res.json({
    authenticated: true,
    user: { id: req.user.userId, username: req.user.username },
    idleExpiresAt: new Date(lastSeenAt + SESSION_IDLE_TIMEOUT_MS).toISOString(),
    reauthRequiredAt: new Date(authenticatedAt + SESSION_ABSOLUTE_TIMEOUT_MS).toISOString(),
  });
};

module.exports = {
  csrfToken,
  registerUser,
  loginUser,
  logoutUser,
  getSession,
  // Re-exported for the legacy controller.js bridge
  ...require("./profile.controller"),
};
