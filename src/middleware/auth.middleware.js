const User = require('../models/user.model');
const { destroySession } = require('./session.middleware');
const { logSecurityEvent } = require('../utils/securityLogger');
const { SESSION_IDLE_TIMEOUT_MS, SESSION_ABSOLUTE_TIMEOUT_MS } = require('../config');

// Session authentication. Enforces both timeouts server-side (the cookie expiry
// alone can't be trusted): 30 min idle, 8 h since the password was entered.
const requireAuth = async (req, res, next) => {
  try {
    const { userId, authenticatedAt, lastSeenAt } = req.session || {};
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const now = Date.now();
    let expired = null;
    if (!authenticatedAt || now - authenticatedAt > SESSION_ABSOLUTE_TIMEOUT_MS) expired = 'absolute';
    else if (!lastSeenAt || now - lastSeenAt > SESSION_IDLE_TIMEOUT_MS) expired = 'idle';

    if (expired) {
      logSecurityEvent('session.expired', { req, level: 'info', userId, reason: expired });
      await destroySession(req, res);
      return res.status(401).json({
        error: 'Session expired, please log in again',
        reason: expired === 'idle' ? 'IDLE_TIMEOUT' : 'REAUTH_REQUIRED',
      });
    }

    // Load the user on every request so deleted accounts lose access immediately
    const user = await User.findById(userId).select('username role');
    if (!user) {
      await destroySession(req, res);
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.session.lastSeenAt = now;
    req.user = { userId: String(user._id), username: user.username, role: user.role || 'user' };
    next();
  } catch (error) {
    next(error);
  }
};

// Use after requireAuth. The role is read from the database on every request.
const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    logSecurityEvent('authz.denied', { req, userId: req.user?.userId, requiredRole: role });
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

module.exports = {
  requireAuth,
  requireRole,
  // Old name kept for legacy imports (controller.js)
  authenticateToken: requireAuth,
};
