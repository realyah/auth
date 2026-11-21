require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const PLACEHOLDER_SECRET = "your_jwt_secret_key_here";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === PLACEHOLDER_SECRET) {
  if (NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong secret in production");
  }
  console.warn("Warning: JWT_SECRET is not set to a real secret. Set it in .env.");
}

// TRUST_PROXY: "true"/"false", a hop count ("1"), or a list of subnets ("loopback, 10.0.0.0/8").
// Only enable this when the app runs behind a reverse proxy you control,
// otherwise clients can spoof their IP via the X-Forwarded-For header.
const parseTrustProxy = (value) => {
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
};

// CORS_ORIGIN: comma-separated list of allowed origins, or "*" (default) to allow all.
const parseCorsOrigin = (value) => {
  if (!value || value.trim() === "*") return "*";
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
};

module.exports = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 4000,
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/auth",
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  CORS_ORIGIN: parseCorsOrigin(process.env.CORS_ORIGIN),
};
