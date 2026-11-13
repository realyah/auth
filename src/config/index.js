require("dotenv").config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "your_jwt_secret_key_here") {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong secret in production");
  }
  console.warn("Warning: JWT_SECRET is not set to a real secret. Set it in .env.");
}

module.exports = {
  PORT: process.env.PORT || 4000,
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/auth",
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
};
