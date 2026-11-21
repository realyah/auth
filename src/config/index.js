require("dotenv").config();
const crypto = require("crypto");
const path = require("path");

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const PLACEHOLDER_SECRETS = new Set(["", "change_me", "your_session_secret_here"]);

// Secrets: required and strong in production, random per-process in development
// (sessions are then lost on restart, which is fine for local work).
const requireSecret = (name, { minLength = 32 } = {}) => {
  const value = process.env[name] || "";
  const valid = !PLACEHOLDER_SECRETS.has(value) && value.length >= minLength;
  if (valid) return value;
  if (IS_PRODUCTION) {
    throw new Error(`${name} must be set to a strong secret (${minLength}+ characters) in production`);
  }
  if (NODE_ENV !== "test") {
    console.warn(`Warning: ${name} is not set; using a random value for this process. Set it in .env.`);
  }
  return crypto.randomBytes(minLength).toString("hex");
};

// TRUST_PROXY: "true"/"false", a hop count ("1"), or a list of subnets ("loopback, 10.0.0.0/8").
// Only enable this when the app runs behind a reverse proxy you control,
// otherwise clients can spoof their IP via the X-Forwarded-For header.
const parseTrustProxy = (value) => {
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
};

// CORS_ORIGIN: comma-separated list of allowed frontend origins. Cookies are sent
// cross-origin, so a wildcard is not allowed.
const parseCorsOrigin = (value) => {
  const origins = (value || "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.includes("*")) {
    throw new Error("CORS_ORIGIN cannot be \"*\" when using cookie sessions; list the frontend origins");
  }
  if (origins.length) return origins;
  if (IS_PRODUCTION) throw new Error("CORS_ORIGIN must be set in production");
  return ["http://localhost:3000", "http://localhost:5173"];
};

const parseBool = (value, fallback) => {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
};

const REDIS_URL = process.env.REDIS_URL || "";
if (IS_PRODUCTION && !REDIS_URL) {
  throw new Error("REDIS_URL must be set in production (sessions and rate limits are stored in Redis)");
}

// Secure cookies need HTTPS. Default on in production; for local http work it is off.
const COOKIE_SECURE = parseBool(process.env.COOKIE_SECURE, IS_PRODUCTION);

module.exports = {
  NODE_ENV,
  IS_PRODUCTION,
  PORT: Number(process.env.PORT) || 4000,
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/auth",
  REDIS_URL,
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  CORS_ORIGIN: parseCorsOrigin(process.env.CORS_ORIGIN),
  // Reject plain-HTTP requests (needs TRUST_PROXY behind a TLS-terminating proxy)
  FORCE_HTTPS: parseBool(process.env.FORCE_HTTPS, IS_PRODUCTION),

  // Sessions
  SESSION_SECRET: requireSecret("SESSION_SECRET"),
  COOKIE_SECURE,
  // The __Host- prefix requires the Secure flag, so it is only used over HTTPS
  SESSION_COOKIE_NAME: COOKIE_SECURE ? "__Host-sid" : "sid",
  SESSION_IDLE_TIMEOUT_MS: 30 * MINUTE,
  SESSION_ABSOLUTE_TIMEOUT_MS: 8 * HOUR,

  // Login protection
  LOGIN_RATE_LIMIT_WINDOW_MS: 15 * MINUTE,
  LOGIN_RATE_LIMIT_MAX: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  MAX_FAILED_ATTEMPTS: 5,
  LOCK_DURATION_MS: 30 * MINUTE,

  // Cloudflare Turnstile: CAPTCHA on login/register is enforced only when set
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || "",

  // Optional HTTP endpoint that receives security events as JSON (in addition to stdout)
  SECURITY_LOG_WEBHOOK_URL: process.env.SECURITY_LOG_WEBHOOK_URL || "",

  // Login location tracking: MaxMind GeoLite2-City database (optional) and how long
  // exact coordinates are kept before only country/city remain
  GEOIP_DB_PATH: path.resolve(process.env.GEOIP_DB_PATH || path.join(__dirname, "../../data/GeoLite2-City.mmdb")),
  LOGIN_EVENT_EXACT_RETENTION_DAYS: Number(process.env.LOGIN_EVENT_EXACT_RETENTION_DAYS) || 90,

  // Where uploaded files (profile pictures) are stored on disk
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads")),
};
