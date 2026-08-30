const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Import controllers
const {
  registerUser,
  loginUser,
  getUserProfile,
  createTodo,
  getTodos,
  updateTodo,
  deleteTodo,
  authenticateToken,
  CreateAllAboutMe,
  getAllAboutMe
} = require('./controller');

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = 'mongodb://localhost:27017/';
const JWT_SECRET = 'your-secret-key';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  }
}, {
  timestamps: true
});

// ToDo Schema
const todoSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    ref: 'User'
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['created', 'done', 'deleted'],
    default: 'created'
  }
}, {
  timestamps: true
});

// AboutMe Schema
const aboutMeSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    ref: 'User'
  },
  name: { type: String, required: true, trim: true },
  birthday: { type: String, trim: true },
  status: { type: String, trim: true },
  from: { type: String, trim: true },
  title: { type: String, trim: true },
  favoriteColor: { type: String, trim: true },
  favoriteSong: { type: String, trim: true },
  favoriteMovie: { type: String, trim: true },
  favoriteFood: { type: String, trim: true },
  myHobbies: { type: String, trim: true },
  wordsThatDescribeMe: { type: String, trim: true },
  myDreams: { type: String, trim: true },
  thingsILove: { type: String, trim: true },
  funFactsAboutMe: { type: String, trim: true },
  myMoto: { type: String, trim: true }
}, {
  timestamps: true
});

// Models
const User = mongoose.model('User', userSchema);
const Todo = mongoose.model('Todo', todoSchema);
const AboutMe = mongoose.model('AboutMe', aboutMeSchema);

// Make models available globally for controllers
global.User = User;
global.Todo = Todo;
global.AboutMe = AboutMe;
global.JWT_SECRET = JWT_SECRET;
global.bcryptjs = bcryptjs;
global.jwt = jwt;

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'ToDo List API is running!' });
});

// Authentication routes
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);

// Todo routes (protected)
app.post('/api/todos', authenticateToken, createTodo);
app.get('/api/todos', authenticateToken, getTodos);
app.put('/api/todos/:id', authenticateToken, updateTodo);
app.delete('/api/todos/:id', authenticateToken, deleteTodo);
app.get('/api/auth/profile', authenticateToken, getUserProfile);
app.post('/api/allaboutme', authenticateToken, CreateAllAboutMe);
app.get('/api/allaboutme', authenticateToken, getAllAboutMe);
// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; 