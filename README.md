# ToDo List & Profile API

REST API built with **Express.js** and **MongoDB (Mongoose)**: hardened session login, player profiles with profile pictures, to-do management, and an admin map of where logins come from.

**Features**
- Session login with Argon2id passwords, CSRF protection, rate limiting and account lockout
- Player profiles: editable details and profile picture upload
- To-dos and an "All About Me" page per user
- Login location tracking (GPS or IP) with an admin-only API for a map view

---

## 📁 Project Structure

```text
├── src/
│   ├── config/
│   │   ├── index.js                  # Environment config + production safety checks
│   │   ├── db.js                     # MongoDB connection
│   │   └── redis.js                  # Redis client (sessions + rate limits)
│   ├── controllers/
│   │   ├── auth.controller.js        # Register, login, logout, session, CSRF token
│   │   ├── profile.controller.js     # Player profile + profile picture
│   │   ├── admin.controller.js       # Login events for the admin map
│   │   ├── todo.controller.js        # Todo CRUD
│   │   └── aboutMe.controller.js     # "About Me" page
│   ├── middleware/
│   │   ├── auth.middleware.js        # requireAuth (timeouts) + requireRole
│   │   ├── session.middleware.js     # express-session + secure cookie
│   │   ├── csrf.middleware.js        # CSRF token check
│   │   ├── security.middleware.js    # Helmet headers, HTTPS-only
│   │   ├── rateLimit.middleware.js   # Per-IP login/register limits
│   │   ├── captcha.middleware.js     # Optional Cloudflare Turnstile
│   │   ├── validate.middleware.js    # Zod validation
│   │   ├── upload.middleware.js      # Profile picture upload (multer)
│   │   └── error.middleware.js       # 404 + central error handler
│   ├── models/                       # User, LoginEvent, Todo, AboutMe
│   ├── routes/                       # /api/auth, /api/admin, /api/todos, /api/allaboutme
│   ├── validation/schemas.js         # All Zod input schemas
│   ├── utils/
│   │   ├── password.js               # Argon2id hashing + dummy hash
│   │   ├── geo.js                    # IP lookup (MaxMind) + GPS checks
│   │   ├── securityLogger.js         # JSON security events, secrets redacted
│   │   └── crypto.js                 # Constant-time compare, random tokens
│   ├── jobs/loginEventRetention.js   # Daily job: drop exact coordinates after 90 days
│   ├── app.js                        # Express app + middleware order
│   └── server.js                     # Startup + graceful shutdown
├── scripts/make-admin.js             # Grant / revoke the admin role
├── test/api.test.js                  # Integration tests (node:test)
├── data/                             # GeoLite2-City.mmdb goes here (not in git)
├── uploads/                          # Profile pictures (not in git)
├── .env.example                      # Every environment variable, documented
├── app.js, controller.js             # Backward-compatibility bridges
└── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) 18 or newer
- [MongoDB](https://www.mongodb.com/) running locally or on Atlas
- [Redis](https://redis.io/): optional in development, **required in production**
  ```bash
  brew install redis && brew services start redis   # macOS
  ```

### 2. Install
```bash
npm install
cp .env.example .env
```

### 3. Configure `.env`
Minimum for local development:
```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/todolist
SESSION_SECRET=<random string, see below>
CORS_ORIGIN=http://localhost:3000
REDIS_URL=redis://127.0.0.1:6379     # optional locally, required in production
```

Generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Without `REDIS_URL` and `SESSION_SECRET`, sessions are kept in memory and everyone is logged out whenever the server restarts (e.g. nodemon reloading on save). See `.env.example` for every option.

### 4. Run
| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server with auto-reload |
| `npm start` | Production server |
| `npm test` | Integration tests (needs MongoDB; uses and drops a throwaway database, set `MONGODB_URI_TEST` to change it) |
| `npm run make-admin -- <username>` | Make a user admin (`--revoke` to undo) |

The API runs at `http://localhost:4000`.

### 5. Optional: IP location lookup
Login locations come from the browser's GPS when the user shares it. To also locate logins by IP address:
1. Create a free account at [maxmind.com](https://www.maxmind.com/en/geolite2/signup).
2. Download **GeoLite2-City** and put `GeoLite2-City.mmdb` in `./data/` (or set `GEOIP_DB_PATH`).
3. Refresh it weekly with [`geoipupdate`](https://github.com/maxmind/geoipupdate).

Without the file the server still runs; it logs a warning and stores GPS locations only. Logins from `localhost` never resolve by IP.

### 6. Production checklist
The server refuses to start with `NODE_ENV=production` unless these are set:
- `SESSION_SECRET` (32+ characters)
- `REDIS_URL`
- `CORS_ORIGIN` (explicit origins, `*` is not allowed)

It also requires HTTPS. Behind Nginx, Cloudflare or a load balancer, set `TRUST_PROXY` (e.g. `1`) to match your proxy chain, so client IPs and HTTPS are detected correctly.

---

## 🔌 Connecting a Frontend

The API uses a **session cookie**, not a token:

1. Send every request with `credentials: 'include'` (axios: `withCredentials: true`).
2. Call `GET /api/auth/csrf-token` once on app load. Send the token as the `X-CSRF-Token` header on every `POST`, `PUT` and `DELETE`, including login. Login and logout return a new token; replace the old one.
3. On app start, call `GET /api/auth/session`: `200` means logged in, `401` means show the login screen.

The frontend must be on the **same site** as the API, because the cookie is `SameSite=Strict`. `localhost:3000` → `localhost:4000` works. `127.0.0.1` with `localhost` does not. In production use e.g. `app.example.com` + `api.example.com`. Every frontend origin must be listed in `CORS_ORIGIN`.

---

## 📡 API Endpoints

Responses are JSON. Errors are `{ "error": "message" }`; validation errors (400) also include `details: [{ field, message }]`.

### 🩺 Health
| Method | Endpoint | Description | Login |
|--------|----------|-------------|-------|
| `GET` | `/` | Health check | No |

### 🔐 Auth (`/api/auth`)
| Method | Endpoint | Description | Login |
|--------|----------|-------------|-------|
| `GET` | `/api/auth/csrf-token` | Get the CSRF token for this session | No |
| `POST` | `/api/auth/register` | Create an account: `username` 3–30 chars (letters, numbers, `. _ -`), `password` 12–128 chars | No |
| `POST` | `/api/auth/login` | Log in with `username`, `password` and optional `geo: { lat, lng, accuracy }`; sets the session cookie | No |
| `POST` | `/api/auth/logout` | End the session | No |
| `GET` | `/api/auth/session` | Current user + `idleExpiresAt`, `reauthRequiredAt` | Yes |

Every login failure returns the same `401 "Invalid username or password"`, whether the username is wrong, the password is wrong or the account is locked.

### 👤 Player Profile (`/api/auth/profile`)
| Method | Endpoint | Description | Login |
|--------|----------|-------------|-------|
| `GET` | `/api/auth/profile` | Your profile, including `role` and last-login details | Yes |
| `GET` | `/api/auth/profile/:userId` | Another player's public profile | Yes |
| `PUT` | `/api/auth/profile` | Update `displayName`, `bio`, `country`, `dateOfBirth`, `gender`, `position`, `team` (`null` clears a field) | Yes |
| `POST` | `/api/auth/profile/avatar` | Upload a profile picture: multipart field `avatar`, JPEG/PNG/WebP, max 2 MB | Yes |
| `DELETE` | `/api/auth/profile/avatar` | Remove the profile picture | Yes |
| `GET` | `/uploads/avatars/<file>` | The image file (`avatarUrl` in profile responses) | No |

### 📝 ToDos (`/api/todos`)
| Method | Endpoint | Description | Login |
|--------|----------|-------------|-------|
| `GET` | `/api/todos` | List your todos, newest first (`?status=created\|done\|deleted`) | Yes |
| `POST` | `/api/todos` | Create: `title` (1–100 chars), `description` (max 500) | Yes |
| `PUT` | `/api/todos/:id` | Update `title`, `description` and/or `status` | Yes |
| `DELETE` | `/api/todos/:id` | Delete | Yes |

### 📄 About Me (`/api/allaboutme`)
| Method | Endpoint | Description | Login |
|--------|----------|-------------|-------|
| `POST` | `/api/allaboutme` | Create (`201`, `name` required) or partially update (`200`) | Yes |
| `GET` | `/api/allaboutme` | Get your About Me page (`404` if none yet) | Yes |

### 🗺️ Admin (`/api/admin`)
| Method | Endpoint | Description | Login |
|--------|----------|-------------|-------|
| `GET` | `/api/admin/login-events` | Located login attempts for the map. Query: `days` (1–365, default 30), `limit` (1–5000, default 1000), `userId`, `success` | Admin |

Non-admins get `403 "Forbidden"`.

---

## 👑 Admin Users

Admin is granted only from the command line, never through the API. Run these in **this backend folder**, with a space after `--`:

```bash
npm run make-admin -- <username>            # grant admin
npm run make-admin -- <username> --revoke   # back to normal user
```

The change applies immediately; the user does not need to log out. The role is checked on every request.

---

## 🗺️ Login Location Tracking

Every login attempt, successful or not, is saved in the `loginevents` collection with the IP, country, city, coordinates, accuracy radius and source:
- **GPS:** used when the user ticks "share my location" on the login page. The frontend sends `geo: { lat, lng, accuracy }`. Accurate to about 5–50 m on phones. Readings worse than 5 km are ignored.
- **IP:** used otherwise, through the local GeoLite2 database (see Getting Started, step 5). City-level accuracy, often 5–50 km. Country and city always come from the IP.

Notes:
- A missing or malformed `geo` never blocks login, and recording happens after the response, so it never slows login down.
- A daily job clears exact coordinates after 90 days (`LOGIN_EVENT_EXACT_RETENTION_DAYS`) and keeps country and city.
- Every time an admin opens the login events, it is recorded in the security log.
- GPS and IP can both be faked (devtools, VPN). Treat location as a risk signal, never as proof of identity.
- Location is personal data. Mention IP and location logging in your privacy policy (Thailand PDPA, Laos Law on Electronic Data Protection, GDPR).

---

## 🔒 Security Model

| Control | Implementation |
|---------|----------------|
| Password hashing | Argon2id (m=64 MiB, t=3, p=4); old bcrypt hashes upgraded on next login |
| User enumeration | One message for every login failure; unknown usernames are checked against a dummy hash so timing matches |
| Brute force | 10 login / register attempts per 15 min per IP (stored in Redis); account locked 30 min after 5 wrong passwords; optional Cloudflare Turnstile (`TURNSTILE_SECRET_KEY`) |
| Sessions | Stored in Redis; cookie `__Host-sid`, `HttpOnly`, `Secure`, `SameSite=Strict`; new session id on every login; logout destroys it server-side |
| Timeouts | 30 min idle, 8 h absolute (must log in again), enforced on the server |
| CSRF | Per-session token in the `X-CSRF-Token` header on every `POST` / `PUT` / `DELETE` |
| Headers | Helmet: CSP `default-src 'none'`, HSTS 2 years + preload, `X-Frame-Options: DENY`, `Cache-Control: no-store` on the API |
| Transport | HTTPS required in production |
| Input | Zod schemas on every body, param and query; 10 KB JSON limit |
| Uploads | Real file type checked from the file's bytes, random file names, 2 MB limit |
| Authorization | Admin role read from the database on every request; granted only by CLI |
| Logging | JSON security events on stdout (+ optional `SECURITY_LOG_WEBHOOK_URL`); passwords, tokens and secrets are redacted |

---

## 🛠️ Troubleshooting

| Problem | Cause / fix |
|---------|-------------|
| `/api/auth/session` returns `401` after logging in | The cookie isn't being sent. Use `credentials: 'include'` on **every** request (login too), and use `localhost` for both frontend and API, not a mix with `127.0.0.1`. |
| Logged out after saving a file | Sessions are in memory. Set `REDIS_URL` and `SESSION_SECRET` in `.env`. |
| `403 Invalid or missing CSRF token` | Call `GET /api/auth/csrf-token` and send the token as `X-CSRF-Token`. Use the new token returned by login/logout. |
| CORS error in the browser | Add the frontend's exact origin to `CORS_ORIGIN` (comma-separated). |
| `npm run make-admin` prints npm help | Run it in the backend folder with a space: `npm run make-admin -- yah`, not `--yah`. |
| Admin map is empty | Only logins after this feature are recorded. From `localhost`, points appear only when GPS is shared; IP points need the GeoLite2 file and a public IP. |
| Server won't start in production | Read the error: it names the missing `SESSION_SECRET`, `REDIS_URL` or `CORS_ORIGIN`. |
