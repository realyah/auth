# ToDo List & Profile API

A clean, modular RESTful API built with **Express.js** and **MongoDB (Mongoose)** featuring hardened session authentication (Argon2id, MFA, CSRF), user profiles, and To-Do management.

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
│   │   ├── auth.middleware.js    # Session auth + idle/absolute timeouts
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
SESSION_SECRET=<48 random bytes hex>
MFA_ENCRYPTION_KEY=<32 random bytes hex = 64 chars>
REDIS_URL=redis://127.0.0.1:6379     # required in production
CORS_ORIGIN=http://localhost:3000   # frontend origin(s), comma-separated
TRUST_PROXY=1                        # only when behind a reverse proxy
```

See `.env.example` for every option. Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
In production (`NODE_ENV=production`) the server refuses to start without real secrets, `REDIS_URL` and `CORS_ORIGIN`.

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
| `GET` | `/api/auth/csrf-token` | Get a CSRF token for this session | No |
| `POST` | `/api/auth/register` | Register (password 12–128 chars) | No |
| `POST` | `/api/auth/login` | Password step; returns `SUCCESS` or `MFA_REQUIRED` | No |
| `POST` | `/api/auth/login/mfa` | TOTP `code` or `recoveryCode` step | Pending login |
| `POST` | `/api/auth/logout` | Destroy the session | No |
| `GET` | `/api/auth/session` | Current user + session expiry times | Yes |
| `GET` | `/api/auth/profile` | Current user profile | Yes |
| `GET` | `/api/auth/profile/:userId` | Public player profile by ID | Yes |
| `PUT` | `/api/auth/profile` | Update player details | Yes |
| `POST`/`DELETE` | `/api/auth/profile/avatar` | Upload / remove profile picture | Yes |
| `POST` | `/api/auth/mfa/setup` | Start TOTP enrolment (`password`) → QR code | Yes |
| `POST` | `/api/auth/mfa/enable` | Confirm with `code` → recovery codes | Yes |
| `POST` | `/api/auth/mfa/disable` | `password` + `code` | Yes |

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

## 🔒 Security Model

| Control | Implementation |
|---------|----------------|
| Password hashing | Argon2id (m=64 MiB, t=3, p=4); legacy bcrypt upgraded on login |
| User enumeration | One message for every login failure; unknown users verified against a dummy hash |
| Brute force | 10 login attempts / 15 min per IP (Redis); account locked 30 min after 5 failures; optional Cloudflare Turnstile |
| Sessions | `express-session` in Redis; cookie `__Host-sid`, `HttpOnly`, `Secure`, `SameSite=Strict`; id regenerated on login |
| Timeouts | 30 min idle, 8 h absolute (re-login), enforced server-side |
| CSRF | Per-session token in `X-CSRF-Token` header on every POST/PUT/DELETE |
| Headers | Helmet: CSP `default-src 'none'`, HSTS 2 y + preload, `X-Frame-Options: DENY`, `no-store` on API |
| Transport | HTTPS required in production |
| Input | Zod schemas on every body/param/query; 10 KB JSON limit |
| MFA | TOTP (secrets AES-256-GCM encrypted, replay-protected), 10 one-time recovery codes |
| Logging | JSON security events on stdout (+ optional webhook); secrets redacted |

Frontend requests must use `credentials: 'include'`, call `GET /api/auth/csrf-token` once, and send the token as `X-CSRF-Token` on every state-changing request. The frontend must be same-site with the API (e.g. `app.example.com` + `api.example.com`).
