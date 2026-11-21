const express = require('express');
const router = express.Router();
const {
  createAllAboutMe,
  getAllAboutMe
} = require('../controllers/aboutMe.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { aboutMeBody } = require('../validation/schemas');

// Protect all about-me routes
router.use(requireAuth);

router.post('/', validate({ body: aboutMeBody }), createAllAboutMe);
router.get('/', getAllAboutMe);

module.exports = router;
