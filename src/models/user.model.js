const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    failed_login_attempts: {
      type: Number,
      default: 0,
    },
    lock_until: {
      type: Date,
      default: null,
    },
    login_status: {
      type: String,
      enum: ["SUCCESS", "FAILED_PASSWORD", "LOCKED"],
      default: null,
    },
    // TOTP multi-factor authentication. Secrets are AES-256-GCM encrypted,
    // recovery codes are stored as SHA-256 hashes and consumed on use.
    mfa: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: null },
      pendingSecret: { type: String, default: null },
      lastUsedStep: { type: Number, default: null }, // blocks replay of a used code
      recoveryCodes: { type: [String], default: [] },
    },
    // Stored file name of the profile picture inside UPLOAD_DIR/avatars (null = none)
    avatar: {
      type: String,
      default: null,
    },
    // Public player details, editable by the owner via PUT /api/auth/profile
    profile: {
      displayName: { type: String, trim: true, maxlength: 50 },
      bio: { type: String, trim: true, maxlength: 500 },
      country: { type: String, trim: true, maxlength: 60 },
      dateOfBirth: { type: String, trim: true, maxlength: 20 },
      gender: { type: String, trim: true, maxlength: 20 },
      position: { type: String, trim: true, maxlength: 50 },
      team: { type: String, trim: true, maxlength: 60 },
    },
    userAgentString: {
      browser: { type: String, default: "Unknown" },
      os: { type: String, default: "Unknown" },
      deviceType: { type: String, default: "desktop" },
      ipAddress: { type: String, default: null },
      loginStatus: {
        type: String,
        enum: ["SUCCESS", "FAILED_PASSWORD", "LOCKED"],
        default: null,
      },
      loggedInAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
