const AboutMe = require('../models/aboutMe.model');

const serializeAboutMe = (aboutMe) => {
  const { _id, __v, createdAt, updatedAt, ...rest } = aboutMe.toObject();
  return { id: _id, ...rest, createdAt, updatedAt };
};

// Create or Update All About Me Profile.
// Body is validated by Zod: only known fields, strings or null, max 500 chars.
const createAllAboutMe = async (req, res, next) => {
  try {
    const username = req.user.username;
    const fields = Object.fromEntries(
      Object.entries(req.validated.body).filter(([, value]) => value !== undefined)
    );

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
    if (error.code === 11000) {
      return res.status(409).json({ error: 'About Me profile was modified concurrently, please retry' });
    }
    next(error);
  }
};

// Get All About Me Profile
const getAllAboutMe = async (req, res, next) => {
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
    next(error);
  }
};

module.exports = {
  createAllAboutMe,
  CreateAllAboutMe: createAllAboutMe,
  getAllAboutMe
};
