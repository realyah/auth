const express = require('express');
const router = express.Router();
const { getLoginEvents } = require('../controllers/admin.controller');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { loginEventsQuery } = require('../validation/schemas');

// Every admin route needs a logged-in admin
router.use(requireAuth, requireRole('admin'));

router.get('/login-events', validate({ query: loginEventsQuery }), getLoginEvents);

module.exports = router;
