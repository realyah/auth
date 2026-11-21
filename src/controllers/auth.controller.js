const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const argon2 = require("argon2");
const User = require("../models/user.model");
const UAParser = require('ua-parser-js');
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config");

// Password hashing helper using Argon2id
const hashPassword = async (plainPassword) => {
  return await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
};

// Password verification helper (supports Argon2 and legacy bcrypt)
const verifyPassword = async (hash, plainPassword) => {
  if (typeof hash !== "string" || !hash) return false;
  if (hash.startsWith("$argon2")) {
    return await argon2.verify(hash, plainPassword);
  }
  return await bcryptjs.compare(plainPassword, hash);
};

// Parse User-Agent header into structured browser, OS, and device info
const parseUserAgent = (uaHeader = "") => {
  const parsed = UAParser(uaHeader);
  const browser = parsed.browser.name
    ? [parsed.browser.name, parsed.browser.version].filter(Boolean).join(" ")
    : "Unknown";
  const os = parsed.os.name
    ? [parsed.os.name, parsed.os.version].filter(Boolean).join(" ")
    : "Unknown";
  const deviceType = parsed.device.type || "desktop";

  return {
    browser,
    os,
    deviceType,
  };
};

// Client IP address. Uses req.ip, which honours X-Forwarded-For only when
// "trust proxy" is configured (see TRUST_PROXY), so clients cannot spoof it.
const getClientIp = (req) => {
  const rawIp = req.ip || req.socket?.remoteAddress || "";
  // Normalize IPv6-mapped IPv4 and IPv6 loopback
  return rawIp.replace(/^::ffff:/, "").replace(/^::1$/, "127.0.0.1") || null;
};

// Record the outcome of a login attempt on the user document
const recordLoginAttempt = (user, status, uaInfo, clientIp, now) => {
  user.login_status = status;
  user.userAgentString = {
    ...uaInfo,
    ipAddress: clientIp,
    loginStatus: status,
    loggedInAt: now,
  };
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

// User Registration Controller
const registerUser = async (req, res) => {
  const userAgent = req.headers["user-agent"] || "Unknown";
  try {
    const { password } = req.body || {};
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim() : "";

    // Validation
    if (!username || typeof password !== "string" || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    if (username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ error: "Username must be between 3 and 30 characters" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Hash password with Argon2
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = new User({
      username,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      userAgent,
      user: {
        id: user._id,
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    // Duplicate key from a concurrent registration with the same username
    if (error.code === 11000) {
      return res.status(409).json({ error: "Username already exists" });
    }
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// User Login Controller
const loginUser = async (req, res) => {
  try {
    const { password } = req.body || {};
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim() : "";

    // Validation
    if (!username || typeof password !== "string" || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        status: "FAILED_PASSWORD",
      });
    }

    const now = new Date();
    const clientIp = getClientIp(req);
    const rawUserAgent = req.headers["user-agent"] || "";
    const uaInfo = parseUserAgent(rawUserAgent);

    // 1. Check if account is currently locked
    if (user.lock_until && user.lock_until > now) {
      recordLoginAttempt(user, "LOCKED", uaInfo, clientIp, now);
      await user.save();

      return res.status(403).json({
        error: "Account is locked due to multiple failed login attempts",
        status: "LOCKED",
      });
    }

    // Check password (supports Argon2 and fallback to bcrypt)
    const isValidPassword = await verifyPassword(user.password, password);

    // 2. Handle invalid password
    if (!isValidPassword) {
      // If previous lock has expired, restart counter from 0
      const currentAttempts =
        user.lock_until && user.lock_until <= now
          ? 0
          : user.failed_login_attempts || 0;

      const newAttempts = currentAttempts + 1;
      user.failed_login_attempts = newAttempts;

      // Lock account after too many failed attempts
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lock_until = new Date(now.getTime() + LOCK_DURATION_MS);
        recordLoginAttempt(user, "LOCKED", uaInfo, clientIp, now);
        await user.save();

        return res.status(403).json({
          error: "Account is locked due to multiple failed login attempts",
          status: "LOCKED",
        });
      }

      recordLoginAttempt(user, "FAILED_PASSWORD", uaInfo, clientIp, now);
      await user.save();

      return res.status(401).json({
        error: "Invalid credentials",
        status: "FAILED_PASSWORD",
        remainingAttempts: MAX_FAILED_ATTEMPTS - newAttempts,
      });
    }

    // 3. Handle successful login
    // Transparently upgrade legacy bcrypt hashes to Argon2id
    if (!user.password.startsWith("$argon2")) {
      user.password = await hashPassword(password);
    }
    user.failed_login_attempts = 0;
    user.lock_until = null;
    recordLoginAttempt(user, "SUCCESS", uaInfo, clientIp, now);
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({
      message: "Login successful",
      status: "SUCCESS",
      token,
      userAgent: user.userAgentString,
      user: {
        id: user._id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get User Profile (by URL param :userId or current authenticated user)
const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Find user by ID and exclude password from response
    const user = await User.findById(userId).select("-password -failed_login_attempts -lock_until");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isSelf = String(user._id) === String(req.user?.userId);

    // Login activity (IP, device, status) is private: only the owner may see it
    res.json({
      message: "User profile retrieved successfully",
      user: isSelf
        ? {
            id: user._id,
            username: user.username,
            login_status: user.login_status,
            userAgentString: user.userAgentString,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          }
        : {
            id: user._id,
            username: user.username,
            createdAt: user.createdAt,
          },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
};
