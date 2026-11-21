const LoginEvent = require('../models/loginEvent.model');
const { logSecurityEvent } = require('../utils/securityLogger');

const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/admin/login-events?days=30&limit=1000&userId=&success=
// Only events that have a location; newest first.
const getLoginEvents = async (req, res, next) => {
  try {
    const { days, limit, userId, success } = req.validated.query;

    const filter = {
      lat: { $ne: null },
      createdAt: { $gt: new Date(Date.now() - days * DAY_MS) },
    };
    if (userId) filter.user = userId;
    if (success !== undefined) filter.success = success;

    const events = await LoginEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'username')
      .lean();

    // Access to location data is itself audited
    logSecurityEvent('admin.login_events_viewed', {
      req, level: 'info', userId: req.user.userId, username: req.user.username, days, count: events.length,
    });

    res.json({
      count: events.length,
      events: events.map((e) => ({
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
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getLoginEvents };
