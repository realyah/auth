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
├── test/
│   └── api.test.js               # Integration tests (node:test)
├── .env.example                  # Template for environment variables
├── .gitignore                    # Git ignore file
├── app.js                        # Backward-compatibility bridge
├── controller.js                 # Backward-compatibility bridge
└── package.json                  # Dependencies & scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) running locally or via MongoDB Atlas

### 2. Environment Setup
Copy the example `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Configure your environment variables:
```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/todolist
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
# Optional
CORS_ORIGIN=http://localhost:3000   # comma-separated; default "*"
TRUST_PROXY=1                        # only when behind a reverse proxy
```

Generate a strong `JWT_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
The server refuses to start in production (`NODE_ENV=production`) without a real secret.

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
- **Tests** (needs a running MongoDB; uses and drops a throwaway database):
  ```bash
  MONGODB_URI_TEST=mongodb://127.0.0.1:27017/auth_test npm test
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
| `GET` | `/api/auth/profile/:userId` | Get user profile by ID (login activity only shown for your own profile) | Yes (`Bearer <token>`) |

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
| `POST` | `/api/allaboutme` | Create (`201`, `name` required) or partially update (`200`) About Me profile | Yes |
| `GET` | `/api/allaboutme` | Retrieve About Me profile | Yes |

---

## 🔒 Authentication Flow
For protected endpoints, include the JWT token in the `Authorization` HTTP header:
```text
Authorization: Bearer <your_jwt_token>
```

Missing, malformed, invalid or expired tokens return `401`. After 5 failed login attempts an account is locked for 30 minutes (`403`).
