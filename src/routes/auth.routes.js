const express = require('express');
const router = express.Router();
const {
  csrfToken,
  registerUser,
  loginUser,
  loginMfa,
  logoutUser,
  getSession,
} = require('../controllers/auth.controller');
const {
  getUserProfile,
  updateUserProfile,
  uploadUserAvatar,
  deleteUserAvatar,
} = require('../controllers/profile.controller');
const { setupMfa, enableMfa, disableMfa } = require('../controllers/mfa.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { uploadAvatar } = require('../middleware/upload.middleware');
const { verifyCaptcha } = require('../middleware/captcha.middleware');
const { validate } = require('../middleware/validate.middleware');
const { loginLimiter, registerLimiter, mfaLimiter } = require('../middleware/rateLimit.middleware');
const schemas = require('../validation/schemas');

// Public
router.get('/csrf-token', csrfToken);
router.post('/register', registerLimiter, validate({ body: schemas.registerBody }), verifyCaptcha, registerUser);
router.post('/login', loginLimiter, validate({ body: schemas.loginBody }), verifyCaptcha, loginUser);
router.post('/login/mfa', mfaLimiter, validate({ body: schemas.mfaLoginBody }), loginMfa);
router.post('/logout', logoutUser);

// Authenticated
router.get('/session', requireAuth, getSession);
router.get('/profile', requireAuth, getUserProfile);
router.get('/profile/:userId', requireAuth, validate({ params: schemas.userIdParams }), getUserProfile);
router.put('/profile', requireAuth, validate({ body: schemas.profileBody }), updateUserProfile);
router.post('/profile/avatar', requireAuth, uploadAvatar, uploadUserAvatar);
router.delete('/profile/avatar', requireAuth, deleteUserAvatar);

router.post('/mfa/setup', requireAuth, mfaLimiter, validate({ body: schemas.mfaSetupBody }), setupMfa);
router.post('/mfa/enable', requireAuth, mfaLimiter, validate({ body: schemas.mfaEnableBody }), enableMfa);
router.post('/mfa/disable', requireAuth, mfaLimiter, validate({ body: schemas.mfaDisableBody }), disableMfa);

module.exports = router;
