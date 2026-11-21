const LoginEvent = require('../models/loginEvent.model');
const { logSecurityEvent } = require('../utils/securityLogger');

const DAY_MS = 24 * 60 * 60 * 1000;

const findLoginEvents = ({ days, limit, success, userId, locatedOnly }) => {
  const filter = { createdAt: { $gt: new Date(Date.now() - days * DAY_MS) } };
  if (locatedOnly) filter.lat = { $ne: null };
  if (userId) filter.user = userId;
  if (success !== undefined) filter.success = success;

  return LoginEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'username')
    .lean();
};

const serializeEvent = (e) => ({
  id: e._id,
  userId: e.user?._id ?? null,
  username: e.user?.username ?? null,
  success: e.success,
  ip: e.ip,
  country: e.country,
  city: e.city,
  lat: e.lat,
  lng: e.lng,
  accuracyM: e.accuracyM,
  source: e.source,
  createdAt: e.createdAt,
});

// GET /api/admin/login-events?days=30&limit=1000&userId=&success=   (admin only)
// Everyone's located login attempts, newest first.
const getAllLoginEvents = async (req, res, next) => {
  try {
    const { days, limit, userId, success } = req.validated.query;
    const events = await findLoginEvents({ days, limit, userId, success, locatedOnly: true });

    // Access to other people's location data is itself audited
    logSecurityEvent('admin.login_events_viewed', {
      req, level: 'info', userId: req.user.userId, username: req.user.username, days, count: events.length,
    });

    res.json({ count: events.length, events: events.map(serializeEvent) });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/login-events?days=30&limit=100&success=   (any logged-in user)
// The caller's OWN login attempts only (successful and failed), newest first.
// The user id comes from the session, never from the request, so nobody can
// read another account's locations here. Includes attempts without coordinates.
const getMyLoginEvents = async (req, res, next) => {
  try {
    const { days, limit, success } = req.validated.query;
    const events = await findLoginEvents({ days, limit, success, userId: req.user.userId, locatedOnly: false });
    res.json({ count: events.length, events: events.map(serializeEvent) });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllLoginEvents, getMyLoginEvents };
