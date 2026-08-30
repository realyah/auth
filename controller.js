// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// User Registration Controller
const registerUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcryptjs.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      password: hashedPassword
    });

    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        username: user.username,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// User Login Controller
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcryptjs.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// Get Current User Profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find user by ID and exclude password from response
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User profile retrieved successfully',
      user: {
        id: user._id,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Create or Update All About Me Profile
const CreateAllAboutMe = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const username = req.user.username;
    const update = { username, ...req.body };
    const aboutMe = await AboutMe.findOneAndUpdate(
      { username },
      update,
      { new: true, upsert: true, runValidators: true }
    );
    const doc = aboutMe && (aboutMe.toObject ? aboutMe.toObject() : aboutMe);
    if (doc) {
      const { createdAt, updatedAt, __v, _id, ...rest } = doc;
      const ordered = { id: _id || doc._id, ...rest, createdAt, updatedAt };
      return res.status(201).json({ message: 'About Me profile saved successfully', aboutMe: ordered });
    }
    return res.status(201).json({ message: 'About Me profile saved successfully', aboutMe });
  } catch (error) {
    console.error('Create all about me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


// Get All About Me Profile
const getAllAboutMe = async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const username = req.user.username;
    const aboutMe = await AboutMe.findOne({ username });
    if (!aboutMe) {
      return res.status(404).json({ error: 'About Me profile not found' });
    }
    const doc = aboutMe && (aboutMe.toObject ? aboutMe.toObject() : aboutMe);
    if (doc) {
      const { createdAt, updatedAt, __v, _id, ...rest } = doc;
      const ordered = { id: _id || doc._id, ...rest, createdAt, updatedAt };
      return res.status(200).json({ message: 'About Me profile retrieved successfully', aboutMe: ordered });
    }
    return res.status(200).json({ message: 'About Me profile retrieved successfully', aboutMe });
  } catch (error) {
    console.error('Get all about me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Create Todo Controller
const createTodo = async (req, res) => {
  try {
    const { title, description } = req.body;
    const username = req.user.username;

    // Validation
    // if (!token){
    //   return res.status(400).json({error: 'Can not create title'})
    // }
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (title.length > 100) {
      return res.status(400).json({ error: 'Title must be 100 characters or less' });
    }

    if (description && description.length > 500) {
      return res.status(400).json({ error: 'Description must be 500 characters or less' });
    }

    // Create todo
    const todo = new Todo({
      username,
      title,
      description: description || '',
      status: 'created'
    });

    await todo.save();

    res.status(201).json({
      message: 'Todo created successfully',
      todo: {
        id: todo._id,
        username: todo.username,
        title: todo.title,
        description: todo.description,
        status: todo.status,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt
      }
    });

  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Todos Controller
const getTodos = async (req, res) => {
  try {
    const username = req.user.username;
    const { status } = req.query;

    // Build query
    let query = { username };
    if (status && ['created', 'done', 'deleted'].includes(status)) {
      query.status = status;
    }

    // Get todos
    const todos = await Todo.find(query).sort({ createdAt: -1 });

    res.json({
      message: 'Todos retrieved successfully',
      count: todos.length,
      todos: todos.map(todo => ({
        id: todo._id,
        username: todo.username,
        title: todo.title,
        description: todo.description,
        status: todo.status,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt
      }))
    });

  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update Todo Controller
const updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;
    const username = req.user.username;

    // Validation
    if (status && !['created', 'done', 'deleted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: created, done, or deleted' });
    }

    if (title && title.length > 100) {
      return res.status(400).json({ error: 'Title must be 100 characters or less' });
    }

    if (description && description.length > 500) {
      return res.status(400).json({ error: 'Description must be 500 characters or less' });
    }

    // Find and update todo
    const todo = await Todo.findOne({ _id: id, username });
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Update fields
    if (title !== undefined) todo.title = title;
    if (description !== undefined) todo.description = description;
    if (status !== undefined) todo.status = status;

    await todo.save();

    res.json({
      message: 'Todo updated successfully',
      todo: {
        id: todo._id,
        username: todo.username,
        title: todo.title,
        description: todo.description,
        status: todo.status,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt
      }
    });

  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete Todo Controller
const deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username;

    // Find and delete todo
    const todo = await Todo.findOneAndDelete({ _id: id, username });
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
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  authenticateToken,
  registerUser,
  loginUser,
  getUserProfile,
  createTodo,
  getTodos,
  updateTodo,
  deleteTodo,
  CreateAllAboutMe,
  getAllAboutMe
}; 