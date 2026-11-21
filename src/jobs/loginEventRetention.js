const LoginEvent = require('../models/loginEvent.model');
const { LOGIN_EVENT_EXACT_RETENTION_DAYS } = require('../config');

const DAY_MS = 24 * 60 * 60 * 1000;

// Privacy: after the retention period keep only country/city, drop the exact point
const coarsenOldLoginEvents = async (now = Date.now()) => {
  const cutoff = new Date(now - LOGIN_EVENT_EXACT_RETENTION_DAYS * DAY_MS);
  const result = await LoginEvent.updateMany(
    { createdAt: { $lt: cutoff }, lat: { $ne: null } },
    { $set: { lat: null, lng: null, accuracyM: null } }
  );
  return result.modifiedCount;
};

// Runs at startup and then once a day
const startLoginEventRetentionJob = () => {
  const run = () =>
    coarsenOldLoginEvents()
      .then((count) => count && console.log(`Login events: coarsened ${count} old locations`))
      .catch((error) => console.error('Login event retention job failed:', error));
  run();
  return setInterval(run, DAY_MS).unref();
};

module.exports = { coarsenOldLoginEvents, startLoginEventRetentionJob };
