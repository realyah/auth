const User = require("../models/user.model");
const { verifyPassword } = require("../utils/password");
const {
  generateSecret,
  encryptSecret,
  buildEnrollment,
  verifyTotp,
  generateRecoveryCodes,
} = require("../utils/totp");
const { logSecurityEvent } = require("../utils/securityLogger");

// Re-check the password before any MFA change, so a hijacked session alone can't
// enroll an attacker's device or switch MFA off.
const confirmPassword = async (req, res, user, password) => {
  if (await verifyPassword(user.password, password)) return true;
  logSecurityEvent("mfa.password_confirm_failed", { req, userId: String(user._id) });
  res.status(401).json({ error: "Password is incorrect" });
  return false;
};

// POST /api/auth/mfa/setup { password } → QR code to scan
const setupMfa = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.mfa?.enabled) {
      return res.status(409).json({ error: "MFA is already enabled" });
    }
    if (!(await confirmPassword(req, res, user, req.validated.body.password))) return;

    const secret = generateSecret();
    user.mfa.pendingSecret = encryptSecret(secret);
    await user.save();

    res.json({
      message: "Scan the QR code, then confirm with a code from the app",
      ...(await buildEnrollment(user.username, secret)),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/mfa/enable { code } → turns MFA on, returns one-time recovery codes
const enableMfa = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.mfa?.enabled) {
      return res.status(409).json({ error: "MFA is already enabled" });
    }
    if (!user.mfa?.pendingSecret) {
      return res.status(400).json({ error: "Start MFA setup first" });
    }

    const step = verifyTotp(user.mfa.pendingSecret, req.validated.body.code, null);
    if (step === null) {
      return res.status(400).json({ error: "Invalid authentication code" });
    }

    const { codes, hashes } = generateRecoveryCodes();
    user.mfa.enabled = true;
    user.mfa.secret = user.mfa.pendingSecret;
    user.mfa.pendingSecret = null;
    user.mfa.lastUsedStep = step;
    user.mfa.recoveryCodes = hashes;
    await user.save();

    logSecurityEvent("mfa.enabled", { req, level: "info", userId: String(user._id) });
    res.json({
      message: "MFA enabled. Save these recovery codes somewhere safe; they are shown only once.",
      recoveryCodes: codes,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/mfa/disable { password, code }
const disableMfa = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.mfa?.enabled) {
      return res.status(400).json({ error: "MFA is not enabled" });
    }
    if (!(await confirmPassword(req, res, user, req.validated.body.password))) return;

    const step = verifyTotp(user.mfa.secret, req.validated.body.code, user.mfa.lastUsedStep);
    if (step === null) {
      logSecurityEvent("mfa.disable_failed", { req, userId: String(user._id) });
      return res.status(400).json({ error: "Invalid authentication code" });
    }

    user.mfa = { enabled: false, secret: null, pendingSecret: null, lastUsedStep: null, recoveryCodes: [] };
    await user.save();

    logSecurityEvent("mfa.disabled", { req, userId: String(user._id) });
    res.json({ message: "MFA disabled" });
  } catch (error) {
    next(error);
  }
};

module.exports = { setupMfa, enableMfa, disableMfa };
