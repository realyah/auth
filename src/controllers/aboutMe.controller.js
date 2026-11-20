const AboutMe = require('../models/aboutMe.model');

// Fields a client may set; everything else (username, _id, timestamps, unknown keys) is ignored.
const EDITABLE_FIELDS = Object.keys(AboutMe.schema.paths).filter(
  (path) => !['username', '_id', '__v', 'createdAt', 'updatedAt'].includes(path)
);

const serializeAboutMe = (aboutMe) => {
  const { _id, __v, createdAt, updatedAt, ...rest } = aboutMe.toObject();
  return { id: _id, ...rest, createdAt, updatedAt };
};

// Create or Update All About Me Profile
const createAllAboutMe = async (req, res) => {
  try {
    const username = req.user.username;
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const fields = {};
    for (const key of EDITABLE_FIELDS) {
      if (body[key] === undefined) continue;
      if (body[key] !== null && typeof body[key] !== 'string') {
        return res.status(400).json({ error: `Field "${key}" must be a string` });
      }
      fields[key] = body[key];
    }

    let aboutMe = await AboutMe.findOne({ username });
    const isNew = !aboutMe;
    if (isNew) {
      aboutMe = new AboutMe({ username });
    }

    // Full document validation runs on save, so required fields (e.g. name) are enforced
    aboutMe.set(fields);
    await aboutMe.save();

    return res.status(isNew ? 201 : 200).json({
      message: 'About Me profile saved successfully',
      aboutMe: serializeAboutMe(aboutMe)
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'About Me profile was modified concurrently, please retry' });
    }
    console.error('Create all about me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get All About Me Profile
const getAllAboutMe = async (req, res) => {
  try {
    const aboutMe = await AboutMe.findOne({ username: req.user.username });

    if (!aboutMe) {
      return res.status(404).json({ error: 'About Me profile not found' });
    }

    return res.status(200).json({
      message: 'About Me profile retrieved successfully',
      aboutMe: serializeAboutMe(aboutMe)
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
