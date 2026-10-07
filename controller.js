// Compatibility bridge for legacy controller imports
const authController = require('./src/controllers/auth.controller');
const todoController = require('./src/controllers/todo.controller');
const aboutMeController = require('./src/controllers/aboutMe.controller');
const { authenticateToken } = require('./src/middleware/auth.middleware');

module.exports = {
  authenticateToken,
  registerUser: authController.registerUser,
  loginUser: authController.loginUser,
  getUserProfile: authController.getUserProfile,
  createTodo: todoController.createTodo,
  getTodos: todoController.getTodos,
  updateTodo: todoController.updateTodo,
  deleteTodo: todoController.deleteTodo,
  CreateAllAboutMe: aboutMeController.createAllAboutMe,
  getAllAboutMe: aboutMeController.getAllAboutMe
};