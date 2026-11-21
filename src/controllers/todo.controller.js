const Todo = require('../models/todo.model');

// Input is validated by Zod (src/validation/schemas.js) before these handlers run;
// they read only req.validated.

const serializeTodo = (todo) => ({
  id: todo._id,
  username: todo.username,
  title: todo.title,
  description: todo.description,
  status: todo.status,
  createdAt: todo.createdAt,
  updatedAt: todo.updatedAt
});

// null clears the description
const normalizeDescription = (description) => (description === null ? '' : description);

// Create Todo Controller
const createTodo = async (req, res, next) => {
  try {
    const { title, description } = req.validated.body;

    const todo = await Todo.create({
      username: req.user.username,
      title,
      description: normalizeDescription(description) || '',
      status: 'created'
    });

    res.status(201).json({
      message: 'Todo created successfully',
      todo: serializeTodo(todo)
    });
  } catch (error) {
    next(error);
  }
};

// Get Todos Controller
const getTodos = async (req, res, next) => {
  try {
    const { status } = req.validated.query;
    const query = { username: req.user.username };
    if (status) query.status = status;

    const todos = await Todo.find(query).sort({ createdAt: -1 });

    res.json({
      message: 'Todos retrieved successfully',
      count: todos.length,
      todos: todos.map(serializeTodo)
    });
  } catch (error) {
    next(error);
  }
};

// Update Todo Controller
const updateTodo = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const { title, description, status } = req.validated.body;

    const todo = await Todo.findOne({ _id: id, username: req.user.username });
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    if (title !== undefined) todo.title = title;
    if (description !== undefined) todo.description = normalizeDescription(description);
    if (status !== undefined) todo.status = status;
    await todo.save();

    res.json({
      message: 'Todo updated successfully',
      todo: serializeTodo(todo)
    });
  } catch (error) {
    next(error);
  }
};

// Delete Todo Controller
const deleteTodo = async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    const todo = await Todo.findOneAndDelete({ _id: id, username: req.user.username });
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json({
      message: 'Todo deleted successfully',
      deletedTodo: {
        id: todo._id,
        title: todo.title,
        status: todo.status
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTodo,
  getTodos,
  updateTodo,
  deleteTodo
};
