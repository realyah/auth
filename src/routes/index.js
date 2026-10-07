const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const todoRoutes = require('./todo.routes');
const aboutMeRoutes = require('./aboutMe.routes');

// Health check endpoint
router.get('/', (req, res) => {
  res.json({ message: 'ToDo List API is running!' });
});

// API resources
router.use('/api/auth', authRoutes);
router.use('/api/todos', todoRoutes);
router.use('/api/allaboutme', aboutMeRoutes);

module.exports = router;
