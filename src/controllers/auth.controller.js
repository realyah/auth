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
  if (hash && hash.startsWith("$argon2")) {
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

// Extract and normalize client IP address
const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = forwarded
    ? forwarded.split(",")[0].trim()
    : req.socket?.remoteAddress || "127.0.0.1";

  // Normalize IPv6 mapped IPv4 and IPv6 loopback
  return rawIp.replace(/^::ffff:/, "").replace(/^::1$/, "127.0.0.1");
};


// User Registration Controller
const registerUser = async (req, res) => {
  const userAgent = req.headers["user-agent"] || "Unknown";
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
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
    console.error("Register user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// User Login Controller
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const now = new Date();

    // Check if account is currently locked
    if (user.lock_until && user.lock_until > now) {
      return res.status(403).json({
        error: "Account is locked due to multiple failed login attempts",
      });
    }

    // Check password (supports Argon2 and fallback to bcrypt)
    const isValidPassword = await verifyPassword(user.password, password);

    if (!isValidPassword) {
      // If previous lock has expired, restart counter from 0
      const currentAttempts =
        user.lock_until && user.lock_until <= now
          ? 0
          : user.failed_login_attempts || 0;

      const newAttempts = currentAttempts + 1;
      user.failed_login_attempts = newAttempts;

      // Lock account if reaching 5 attempts (30 minutes lockout)
      if (newAttempts >= 5) {
        user.lock_until = new Date(now.getTime() + 30 * 60000);
        await user.save();

        return res.status(403).json({
          error: "Account is locked due to multiple failed login attempts",
        });
      }

      await user.save();
      return res.status(401).json({
        error: "Invalid credentials",
        remainingAttempts: 5 - newAttempts,
      });
    }

    // Resolve client IP
    const clientIp = getClientIp(req);

    // Parse user agent into structured browser, OS, and device info
    const rawUserAgent = req.headers["user-agent"] || "";
    const uaInfo = parseUserAgent(rawUserAgent);

    // Reset failed login attempts and persist session/device metadata
    user.failed_login_attempts = 0;
    user.lock_until = null;
    user.userAgentString = {
      browser: uaInfo.browser,
      os: uaInfo.os,
      deviceType: uaInfo.deviceType,
      ipAddress: clientIp,
      loggedInAt: now,
    };
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
      token,
      userAgent: user.userAgentString,
      user: {
        id: user._id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Login user error:", error);
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
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User profile retrieved successfully",
      user: {
        id: user._id,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
