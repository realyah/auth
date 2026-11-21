const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const User = require("../models/user.model");
const { PROFILE_FIELDS } = require("../validation/schemas");
const { UPLOAD_DIR } = require("../config");

const AVATAR_DIR = path.join(UPLOAD_DIR, "avatars");
const avatarUrl = (filename) => (filename ? `/uploads/avatars/${filename}` : null);

// Remove an avatar file from disk; a missing file is not an error
const removeAvatarFile = async (filename) => {
  if (!filename) return;
  try {
    await fs.unlink(path.join(AVATAR_DIR, path.basename(filename)));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Remove avatar file error:", error);
  }
};

const serializeProfile = (user) => {
  const profile = user.profile?.toObject ? user.profile.toObject() : user.profile || {};
  return Object.fromEntries(PROFILE_FIELDS.map((key) => [key, profile[key] ?? null]));
};

// Owner sees login activity; everyone else sees only the public player card
const serializeUser = (user, isSelf) => {
  const publicData = {
    id: user._id,
    username: user.username,
    avatarUrl: avatarUrl(user.avatar),
    profile: serializeProfile(user),
    createdAt: user.createdAt,
  };
  if (!isSelf) return publicData;
  return {
    ...publicData,
    role: user.role || "user", // lets the frontend show the admin dashboard link
    login_status: user.login_status,
    userAgentString: user.userAgentString,
    updatedAt: user.updatedAt,
  };
};

const PRIVATE_FIELDS = "-password -failed_login_attempts -lock_until";

// Get the current user's profile, or another player's public profile by :userId
const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.validated?.params?.userId || req.user.userId;

    const user = await User.findById(userId).select(PRIVATE_FIELDS);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isSelf = String(user._id) === req.user.userId;
    res.json({
      message: "User profile retrieved successfully",
      user: serializeUser(user, isSelf),
    });
  } catch (error) {
    next(error);
  }
};

// Update the current user's player details (partial update; null or "" clears a field)
const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    for (const [key, value] of Object.entries(req.validated.body)) {
      if (value === undefined) continue;
      user.set(`profile.${key}`, value === null || value === "" ? undefined : value);
    }
    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: serializeUser(user, true),
    });
  } catch (error) {
    next(error);
  }
};

// Upload or replace the current user's profile picture
const uploadUserAvatar = async (req, res, next) => {
  const filename = `${crypto.randomUUID()}.${req.file.detectedExt}`;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await fs.mkdir(AVATAR_DIR, { recursive: true });
    await fs.writeFile(path.join(AVATAR_DIR, filename), req.file.buffer);

    const previous = user.avatar;
    user.avatar = filename;
    try {
      await user.save();
    } catch (error) {
      await removeAvatarFile(filename);
      throw error;
    }
    await removeAvatarFile(previous);

    res.json({
      message: "Profile picture uploaded successfully",
      avatarUrl: avatarUrl(filename),
      user: serializeUser(user, true),
    });
  } catch (error) {
    next(error);
  }
};

// Remove the current user's profile picture
const deleteUserAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.avatar) {
      return res.status(404).json({ error: "No profile picture to delete" });
    }

    const previous = user.avatar;
    user.avatar = null;
    await user.save();
    await removeAvatarFile(previous);

    res.json({
      message: "Profile picture deleted successfully",
      user: serializeUser(user, true),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  serializeUser,
  getUserProfile,
  updateUserProfile,
  uploadUserAvatar,
  deleteUserAvatar,
};
