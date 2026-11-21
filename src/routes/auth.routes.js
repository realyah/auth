const express = require('express');
const router = express.Router();
const {
  csrfToken,
  registerUser,
  loginUser,
  logoutUser,
  getSession,
} = require('../controllers/auth.controller');
const {
  getUserProfile,
  updateUserProfile,
  uploadUserAvatar,
  deleteUserAvatar,
} = require('../controllers/profile.controller');
const { getMyLoginEvents } = require('../controllers/loginEvent.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { uploadAvatar } = require('../middleware/upload.middleware');
const { verifyCaptcha } = require('../middleware/captcha.middleware');
const { validate } = require('../middleware/validate.middleware');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit.middleware');
const schemas = require('../validation/schemas');

// Public
router.get('/csrf-token', csrfToken);
router.post('/register', registerLimiter, validate({ body: schemas.registerBody }), verifyCaptcha, registerUser);
router.post('/login', loginLimiter, validate({ body: schemas.loginBody }), verifyCaptcha, loginUser);
router.post('/logout', logoutUser);

// Authenticated
router.get('/session', requireAuth, getSession);
router.get('/login-events', requireAuth, validate({ query: schemas.myLoginEventsQuery }), getMyLoginEvents);
router.get('/profile', requireAuth, getUserProfile);
router.get('/profile/:userId', requireAuth, validate({ params: schemas.userIdParams }), getUserProfile);
router.put('/profile', requireAuth, validate({ body: schemas.profileBody }), updateUserProfile);
router.post('/profile/avatar', requireAuth, uploadAvatar, uploadUserAvatar);
router.delete('/profile/avatar', requireAuth, deleteUserAvatar);

module.exports = router;
