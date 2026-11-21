const mongoose = require('mongoose');
const Todo = require('../models/todo.model');

const STATUSES = ['created', 'done', 'deleted'];
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const serializeTodo = (todo) => ({
  id: todo._id,
  username: todo.username,
  title: todo.title,
  description: todo.description,
  status: todo.status,
  createdAt: todo.createdAt,
  updatedAt: todo.updatedAt
});

// Validate title/description/status from a request body.
// Returns { error } or { values } containing only the fields that were provided.
const validateTodoInput = (body, { requireTitle }) => {
  const { title, description, status } = body;
  const values = {};

  if (title !== undefined || requireTitle) {
    if (typeof title !== 'string' || !title.trim()) {
      return { error: 'Title is required and must be a non-empty string' };
    }
    if (title.trim().length > TITLE_MAX) {
      return { error: `Title must be ${TITLE_MAX} characters or less` };
    }
    values.title = title.trim();
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return { error: 'Description must be a string' };
    }
    if (description.trim().length > DESCRIPTION_MAX) {
      return { error: `Description must be ${DESCRIPTION_MAX} characters or less` };
    }
    values.description = description.trim();
  } else if (description === null) {
    values.description = '';
  }

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return { error: `Invalid status. Must be: ${STATUSES.join(', ')}` };
    }
    values.status = status;
  }

  return { values };
};

const handleError = (res, label, error) => {
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: error.message });
  }
  console.error(`${label} error:`, error);
  return res.status(500).json({ error: 'Internal server error' });
};

// Create Todo Controller
const createTodo = async (req, res) => {
  try {
    const { error, values } = validateTodoInput(req.body || {}, { requireTitle: true });
    if (error) {
      return res.status(400).json({ error });
    }

    const todo = await Todo.create({
      username: req.user.username,
      title: values.title,
      description: values.description || '',
      status: 'created'
    });

    res.status(201).json({
      message: 'Todo created successfully',
      todo: serializeTodo(todo)
    });
  } catch (error) {
    handleError(res, 'Create todo', error);
  }
};

// Get Todos Controller
const getTodos = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { username: req.user.username };

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be: ${STATUSES.join(', ')}` });
      }
      query.status = status;
    }

    const todos = await Todo.find(query).sort({ createdAt: -1 });

    res.json({
      message: 'Todos retrieved successfully',
      count: todos.length,
      todos: todos.map(serializeTodo)
    });
  } catch (error) {
    handleError(res, 'Get todos', error);
  }
};

// Update Todo Controller
const updateTodo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid todo ID format' });
    }

    const { error, values } = validateTodoInput(req.body || {}, { requireTitle: false });
    if (error) {
      return res.status(400).json({ error });
    }

    const todo = await Todo.findOne({ _id: id, username: req.user.username });
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    todo.set(values);
    await todo.save();

    res.json({
      message: 'Todo updated successfully',
      todo: serializeTodo(todo)
    });
  } catch (error) {
    handleError(res, 'Update todo', error);
  }
};

// Delete Todo Controller
const deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid todo ID format' });
    }

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
    handleError(res, 'Delete todo', error);
  }
};

module.exports = {
  createTodo,
  getTodos,
  updateTodo,
  deleteTodo
};
