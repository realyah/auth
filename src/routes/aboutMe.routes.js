const express = require('express');
const router = express.Router();
const {
  createAllAboutMe,
  getAllAboutMe
} = require('../controllers/aboutMe.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Protect all about-me routes
router.use(authenticateToken);

router.post('/', createAllAboutMe);
router.get('/', getAllAboutMe);

module.exports = router;
