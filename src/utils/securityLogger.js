const { SECURITY_LOG_WEBHOOK_URL, NODE_ENV } = require('../config');

// Keys that must never reach a log line, wherever they appear in the details
const REDACTED_KEYS = /pass(word)?|secret|token|code|cookie|authorization/i;

const redact = (value, depth = 0) => {
  if (!value || typeof value !== 'object' || depth > 3) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      REDACTED_KEYS.test(key) ? '[REDACTED]' : redact(inner, depth + 1),
    ])
  );
};

// Structured security event, one JSON line on stdout (collected by the log shipper:
// Datadog, Loki, CloudWatch, ...) and optionally POSTed to SECURITY_LOG_WEBHOOK_URL.
// Never pass raw request bodies here.
const logSecurityEvent = (event, { req, level = 'warn', ...details } = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    type: 'security',
    level,
    event,
    ip: req?.ip || null,
    userAgent: req?.get?.('user-agent')?.slice(0, 256) || null,
    path: req?.originalUrl?.split('?')[0] || null,
    ...redact(details),
  };

  if (NODE_ENV !== 'test') {
    console.log(JSON.stringify(entry));
  }

  if (SECURITY_LOG_WEBHOOK_URL) {
    fetch(SECURITY_LOG_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(3000),
    }).catch((error) => console.error('Security log forwarding failed:', error.message));
  }

  return entry;
};

module.exports = { logSecurityEvent, redact };
