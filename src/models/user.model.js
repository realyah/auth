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
    userAgentString: {
      browser: { type: String, default: "Unknown" },
      os: { type: String, default: "Unknown" },
      deviceType: { type: String, default: "desktop" },
      ipAddress: { type: String, default: null },
      loggedInAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
