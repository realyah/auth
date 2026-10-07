const AboutMe = require('../models/aboutMe.model');

// Create or Update All About Me Profile
const createAllAboutMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const username = req.user.username;
    const update = { username, ...req.body };
    const aboutMe = await AboutMe.findOneAndUpdate(
      { username },
      update,
      { new: true, upsert: true, runValidators: true }
    );

    const doc = aboutMe && (aboutMe.toObject ? aboutMe.toObject() : aboutMe);
    if (doc) {
      const { createdAt, updatedAt, __v, _id, ...rest } = doc;
      const ordered = { id: _id || doc._id, ...rest, createdAt, updatedAt };
      return res.status(201).json({
        message: 'About Me profile saved successfully',
        aboutMe: ordered
      });
    }

    return res.status(201).json({
      message: 'About Me profile saved successfully',
      aboutMe
    });
  } catch (error) {
    console.error('Create all about me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get All About Me Profile
const getAllAboutMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const username = req.user.username;
    const aboutMe = await AboutMe.findOne({ username });

    if (!aboutMe) {
      return res.status(404).json({ error: 'About Me profile not found' });
    }

    const doc = aboutMe && (aboutMe.toObject ? aboutMe.toObject() : aboutMe);
    if (doc) {
      const { createdAt, updatedAt, __v, _id, ...rest } = doc;
      const ordered = { id: _id || doc._id, ...rest, createdAt, updatedAt };
      return res.status(200).json({
        message: 'About Me profile retrieved successfully',
        aboutMe: ordered
      });
    }

    return res.status(200).json({
      message: 'About Me profile retrieved successfully',
      aboutMe
    });
  } catch (error) {
    console.error('Get all about me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createAllAboutMe,
  CreateAllAboutMe: createAllAboutMe,
  getAllAboutMe
};
