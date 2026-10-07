# ToDo List & Profile API

A clean, modular RESTful API built with **Express.js** and **MongoDB (Mongoose)** featuring JWT authentication, user profiles, and To-Do management.

---

## 📁 Project Architecture

The codebase follows the industry-standard modular layered architecture (Controller-Model-Route-Middleware separation):

```text
├── src/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection & lifecycle management
│   │   └── index.js              # Centralized environment & app configuration
│   ├── controllers/
│   │   ├── auth.controller.js    # Authentication & User profile controller
│   │   ├── todo.controller.js    # Todo CRUD controller
│   │   └── aboutMe.controller.js # "About Me" profile controller
│   ├── middleware/
│   │   ├── auth.middleware.js    # JWT verification middleware
│   │   └── error.middleware.js   # 404 & Centralized error handler
│   ├── models/
│   │   ├── user.model.js         # Mongoose User schema & model
│   │   ├── todo.model.js         # Mongoose Todo schema & model
│   │   ├── aboutMe.model.js      # Mongoose AboutMe schema & model
│   │   └── index.js              # Barrel export for models
│   ├── routes/
│   │   ├── auth.routes.js        # /api/auth routes
│   │   ├── todo.routes.js        # /api/todos routes
│   │   ├── aboutMe.routes.js     # /api/allaboutme routes
│   │   └── index.js              # Aggregated router & health check
│   ├── app.js                    # Express application configuration
│   └── server.js                 # HTTP server bootstrap & graceful shutdown
├── .env.example                  # Template for environment variables
├── .gitignore                    # Git ignore file
├── app.js                        # Backward-compatibility bridge
├── controller.js                 # Backward-compatibility bridge
└── package.json                  # Dependencies & scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MongoDB](https://www.mongodb.com/) running locally or via MongoDB Atlas

### 2. Environment Setup
Copy the example `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Configure your environment variables:
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/todolist
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Application
- **Production mode:**
  ```bash
  npm start
  ```
- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```

---

## 📡 API Endpoints

### 🩺 Health Check
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/` | API Health Check | No |

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | Login and get JWT token | No |
| `GET` | `/api/auth/profile` | Get current user profile | Yes (`Bearer <token>`) |

### 📝 ToDos (`/api/todos`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/todos` | Create a new todo | Yes |
| `GET` | `/api/todos` | List todos (filter by `?status=`) | Yes |
| `PUT` | `/api/todos/:id` | Update an existing todo | Yes |
| `DELETE` | `/api/todos/:id` | Delete a todo | Yes |

### 👤 About Me Profile (`/api/allaboutme`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/allaboutme` | Create or update About Me profile | Yes |
| `GET` | `/api/allaboutme` | Retrieve About Me profile | Yes |

---

## 🔒 Authentication Flow
For protected endpoints, include the JWT token in the `Authorization` HTTP header:
```text
Authorization: Bearer <your_jwt_token>
```
