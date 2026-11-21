const express = require('express');
const router = express.Router();
const {
  createTodo,
  getTodos,
  updateTodo,
  deleteTodo
} = require('../controllers/todo.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const schemas = require('../validation/schemas');

// Protect all todo routes
router.use(requireAuth);

router.post('/', validate({ body: schemas.createTodoBody }), createTodo);
router.get('/', validate({ query: schemas.todoQuery }), getTodos);
router.put('/:id', validate({ params: schemas.idParams, body: schemas.updateTodoBody }), updateTodo);
router.delete('/:id', validate({ params: schemas.idParams }), deleteTodo);

module.exports = router;
