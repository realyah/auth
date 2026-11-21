// Integration tests. Requires a reachable MongoDB; uses a throwaway database.
//   MONGODB_URI_TEST=mongodb://127.0.0.1:27017/auth_test npm test
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LOGIN_RATE_LIMIT_MAX = '1000'; // the limiter itself is tested separately
process.env.UPLOAD_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'auth-uploads-'));

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { authenticator } = require('otplib');
const app = require('../src/app');

const MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/auth_test';
const PASSWORD = 'correct horse battery';

let server;
let baseUrl;

// Minimal browser stand-in: keeps the session cookie and CSRF token between calls
const createAgent = () => {
  let cookie = '';
  let csrf = null;

  const request = async (method, path, { body, form, headers = {}, noCsrf = false } = {}) => {
    const unsafe = !['GET', 'HEAD'].includes(method);
    if (unsafe && !csrf && !noCsrf && path.startsWith('/api')) {
      await request('GET', '/api/auth/csrf-token');
    }
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(cookie && { Cookie: cookie }),
        ...(unsafe && csrf && !noCsrf && { 'X-CSRF-Token': csrf }),
        ...headers,
      },
      body: form ?? (body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)),
    });

    const setCookies = res.headers.getSetCookie();
    for (const raw of setCookies) {
      const pair = raw.split(';')[0];
      const value = pair.slice(pair.indexOf('=') + 1);
      if (!value) {
        cookie = '';
        csrf = null;
      } else {
        cookie = pair;
      }
    }

    const text = await res.text();
    const json = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null;
    if (json?.csrfToken) csrf = json.csrfToken;
    return { status: res.status, body: json, headers: res.headers, setCookies };
  };

  return {
    request,
    get cookie() { return cookie; },
    set cookie(value) { cookie = value; },
    get csrf() { return csrf; },
  };
};

const registerAndLogin = async (username, password = PASSWORD) => {
  const agent = createAgent();
  const reg = await agent.request('POST', '/api/auth/register', { body: { username, password } });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  const res = await agent.request('POST', '/api/auth/login', { body: { username, password } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { agent, id: res.body.user.id };
};

// A TOTP code for a later 30 s step (the current one may already be used)
const nextCode = (secret, stepsAhead = 1) =>
  authenticator.clone({ epoch: Date.now() + stepsAhead * 30000 }).generate(secret);

before(async () => {
  await mongoose.connect(MONGODB_URI_TEST, { serverSelectionTimeoutMS: 3000 });
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  require('fs').rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test('health check, 404 and security headers', async () => {
  const agent = createAgent();
  const res = await agent.request('GET', '/');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(res.headers.get('strict-transport-security'), /max-age=63072000; includeSubDomains; preload/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await agent.request('GET', '/nope')).status, 404);

  const api = await agent.request('GET', '/api/auth/csrf-token');
  assert.equal(api.headers.get('cache-control'), 'no-store');
});

test('CORS only allows the configured origin, with credentials', async () => {
  const ok = await fetch(baseUrl + '/api/auth/csrf-token', { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(ok.headers.get('access-control-allow-credentials'), 'true');
  const evil = await fetch(baseUrl + '/api/auth/csrf-token', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
});

test('CSRF token is required on state-changing requests', async () => {
  const agent = createAgent();
  const body = { username: 'csrfuser', password: PASSWORD };
  assert.equal((await agent.request('POST', '/api/auth/register', { body, noCsrf: true })).status, 403);
  await agent.request('GET', '/api/auth/csrf-token');
  assert.equal((await agent.request('POST', '/api/auth/register', { body, headers: { 'X-CSRF-Token': 'wrong' } })).status, 403);
  assert.equal((await agent.request('POST', '/api/auth/register', { body })).status, 201);

  // A token from another session is useless
  const other = createAgent();
  await other.request('GET', '/api/auth/csrf-token');
  const stolen = await other.request('POST', '/api/auth/login', { body, headers: { 'X-CSRF-Token': agent.csrf } });
  assert.equal(stolen.status, 403);
});

test('register validation (Zod) and duplicates', async () => {
  const agent = createAgent();
  const reg = (body) => agent.request('POST', '/api/auth/register', { body });
  assert.equal((await reg({})).status, 400);
  assert.equal((await reg({ username: 'ab', password: PASSWORD })).status, 400);
  assert.equal((await reg({ username: 'alice', password: 'short-pass1' })).status, 400, '11 chars is too short');
  assert.equal((await reg({ username: 'alice', password: 'x'.repeat(129) })).status, 400, '129 chars is too long');
  assert.equal((await reg({ username: 'al ice', password: PASSWORD })).status, 400, 'no spaces');
  assert.equal((await reg({ username: { $ne: 1 }, password: PASSWORD })).status, 400);
  assert.equal((await reg('{bad json')).status, 400);
  assert.equal((await reg({ username: 'alice', password: 'x'.repeat(20000) })).status, 413, 'body size limit');

  const ok = await reg({ username: 'alice', password: 'x'.repeat(12) });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.password, undefined);
  assert.equal((await reg({ username: 'alice', password: PASSWORD })).status, 409);
});

test('login: secure cookie, session fixation protection, logout', async () => {
  const agent = createAgent();
  await agent.request('POST', '/api/auth/register', { body: { username: 'bob', password: PASSWORD } });
  const before = agent.cookie;
  assert.ok(before, 'anonymous session exists for the CSRF token');

  const res = await agent.request('POST', '/api/auth/login', { body: { username: 'bob', password: PASSWORD } });
  assert.equal(res.status, 200);
  assert.equal(res.body.token, undefined, 'no bearer token');
  assert.ok(res.body.csrfToken);
  const setCookie = res.setCookies.join('\n');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\//);
  assert.notEqual(agent.cookie, before, 'session id is regenerated on login');

  // The pre-login session id must not be authenticated
  const fixated = createAgent();
  fixated.cookie = before;
  assert.equal((await fixated.request('GET', '/api/auth/profile')).status, 401);

  const session = await agent.request('GET', '/api/auth/session');
  assert.equal(session.status, 200);
  assert.equal(session.body.user.username, 'bob');
  assert.ok(Date.parse(session.body.reauthRequiredAt) - Date.now() > 7.9 * 3600 * 1000);

  // Logout destroys the session server-side: replaying the old cookie fails
  const stolenCookie = agent.cookie;
  assert.equal((await agent.request('POST', '/api/auth/logout')).status, 200);
  assert.equal((await agent.request('GET', '/api/auth/profile')).status, 401);
  const replay = createAgent();
  replay.cookie = stolenCookie;
  assert.equal((await replay.request('GET', '/api/auth/profile')).status, 401);
});

test('login errors are generic and the account locks after 5 failures', async () => {
  const agent = createAgent();
  await agent.request('POST', '/api/auth/register', { body: { username: 'carol', password: PASSWORD } });
  const login = (username, password) => agent.request('POST', '/api/auth/login', { body: { username, password } });

  const unknown = await login('ghost', PASSWORD);
  const wrong = await login('carol', 'wrong password!!');
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(unknown.body, wrong.body, 'same response for unknown user and wrong password');
  assert.deepEqual(wrong.body, { error: 'Invalid username or password' });

  for (let i = 0; i < 4; i++) await login('carol', 'wrong password!!');
  const locked = await login('carol', PASSWORD);
  assert.equal(locked.status, 401, 'correct password is refused while locked');
  assert.deepEqual(locked.body, wrong.body, 'lock is not revealed');
});

test('unknown usernames are checked against a dummy Argon2id hash', async () => {
  const { getDummyHash } = require('../src/utils/password');
  const hash = await getDummyHash();
  assert.match(hash, /^\$argon2id\$v=19\$/);
  for (const param of ['m=65536', 't=3', 'p=4']) assert.ok(hash.includes(param), param);
});

test('legacy bcrypt hashes still log in and get upgraded to argon2', async () => {
  const bcrypt = require('bcryptjs');
  const User = require('../src/models/user.model');
  await User.create({ username: 'legacy', password: await bcrypt.hash('secret123', 8) });

  const agent = createAgent();
  assert.equal((await agent.request('POST', '/api/auth/login', { body: { username: 'legacy', password: 'secret123' } })).status, 200);
  const user = await User.findOne({ username: 'legacy' });
  assert.ok(user.password.startsWith('$argon2id'));
});

test('rate limiter blocks after the limit per IP', async () => {
  const { createAuthLimiter } = require('../src/middleware/rateLimit.middleware');
  const mini = express();
  mini.post('/login', createAuthLimiter({ name: 'test', max: 3 }), (req, res) => res.json({ ok: true }));
  const s = mini.listen(0);
  const url = `http://127.0.0.1:${s.address().port}/login`;
  try {
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await fetch(url, { method: 'POST' })).status);
    assert.deepEqual(statuses, [200, 200, 200, 429]);
  } finally {
    s.close();
  }
});

test('session idle (30 min) and absolute (8 h) timeouts', async () => {
  const User = require('../src/models/user.model');
  const { requireAuth } = require('../src/middleware/auth.middleware');
  const user = await User.findOne({ username: 'bob' });

  const run = (sessionData) =>
    new Promise((resolve) => {
      const req = {
        session: { ...sessionData, destroy: (cb) => cb() },
        get: () => '',
        originalUrl: '/api/test',
      };
      const res = {
        clearCookie() {},
        status(code) { this.code = code; return this; },
        json(body) { resolve({ status: this.code, body }); },
      };
      requireAuth(req, res, () => resolve({ status: 'next', user: req.user }));
    });

  const now = Date.now();
  const userId = String(user._id);
  assert.equal((await run({ userId, authenticatedAt: now - 1000, lastSeenAt: now - 1000 })).status, 'next');

  const idle = await run({ userId, authenticatedAt: now - 60 * 60e3, lastSeenAt: now - 31 * 60e3 });
  assert.equal(idle.status, 401);
  assert.equal(idle.body.reason, 'IDLE_TIMEOUT');

  const absolute = await run({ userId, authenticatedAt: now - 8 * 3600e3 - 1000, lastSeenAt: now - 1000 });
  assert.equal(absolute.status, 401);
  assert.equal(absolute.body.reason, 'REAUTH_REQUIRED');
});

test('MFA (TOTP): setup, login, replay protection, recovery codes, disable', async () => {
  const { agent } = await registerAndLogin('dave');
  const User = require('../src/models/user.model');

  assert.equal((await agent.request('POST', '/api/auth/mfa/setup', { body: { password: 'wrong password!!' } })).status, 401);
  const setup = await agent.request('POST', '/api/auth/mfa/setup', { body: { password: PASSWORD } });
  assert.equal(setup.status, 200);
  assert.match(setup.body.otpauthUrl, /^otpauth:\/\/totp\//);
  assert.match(setup.body.qrCodeDataUrl, /^data:image\/png;base64,/);
  const secret = setup.body.manualEntryKey;

  const stored = await User.findOne({ username: 'dave' });
  assert.ok(!stored.mfa.pendingSecret.includes(secret), 'secret is encrypted at rest');

  assert.equal((await agent.request('POST', '/api/auth/mfa/enable', { body: { code: '000000' } })).status, 400);
  const enabled = await agent.request('POST', '/api/auth/mfa/enable', { body: { code: authenticator.generate(secret) } });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.recoveryCodes.length, 10);
  const [recoveryCode] = enabled.body.recoveryCodes;

  // Password alone is not enough any more
  const fresh = createAgent();
  const step1 = await fresh.request('POST', '/api/auth/login', { body: { username: 'dave', password: PASSWORD } });
  assert.equal(step1.status, 200);
  assert.equal(step1.body.status, 'MFA_REQUIRED');
  assert.equal((await fresh.request('GET', '/api/auth/profile')).status, 401, 'not logged in yet');
  assert.equal((await fresh.request('POST', '/api/auth/login/mfa', { body: { code: '123456' } })).status, 401);

  const code = nextCode(secret);
  const step2 = await fresh.request('POST', '/api/auth/login/mfa', { body: { code } });
  assert.equal(step2.status, 200, JSON.stringify(step2.body));
  assert.equal((await fresh.request('GET', '/api/auth/profile')).body.user.mfaEnabled, true);

  // The same code cannot be replayed
  const replay = createAgent();
  await replay.request('POST', '/api/auth/login', { body: { username: 'dave', password: PASSWORD } });
  assert.equal((await replay.request('POST', '/api/auth/login/mfa', { body: { code } })).status, 401);

  // Recovery code works exactly once
  const viaRecovery = createAgent();
  await viaRecovery.request('POST', '/api/auth/login', { body: { username: 'dave', password: PASSWORD } });
  assert.equal((await viaRecovery.request('POST', '/api/auth/login/mfa', { body: { recoveryCode } })).status, 200);
  const again = createAgent();
  await again.request('POST', '/api/auth/login', { body: { username: 'dave', password: PASSWORD } });
  assert.equal((await again.request('POST', '/api/auth/login/mfa', { body: { recoveryCode } })).status, 401);

  // MFA step without a password step first
  const skip = createAgent();
  assert.equal((await skip.request('POST', '/api/auth/login/mfa', { body: { code: authenticator.generate(secret) } })).status, 401);

  // A code too far in the future (outside the ±1 step drift window) is rejected
  assert.equal((await fresh.request('POST', '/api/auth/mfa/disable', { body: { password: PASSWORD, code: nextCode(secret, 3) } })).status, 400);

  // Disable needs password + a valid code. Simulate the next 30 s window having started.
  await User.updateOne({ username: 'dave' }, { $set: { 'mfa.lastUsedStep': null } });
  assert.equal((await fresh.request('POST', '/api/auth/mfa/disable', { body: { password: PASSWORD, code: '000000' } })).status, 400);
  const disabled = await fresh.request('POST', '/api/auth/mfa/disable', { body: { password: PASSWORD, code: authenticator.generate(secret) } });
  assert.equal(disabled.status, 200, JSON.stringify(disabled.body));
});

test('security logs never contain passwords', async () => {
  const { logSecurityEvent } = require('../src/utils/securityLogger');
  const entry = logSecurityEvent('login.failed', { username: 'x', password: 'hunter2', nested: { recoveryCode: 'abc' } });
  assert.equal(entry.password, '[REDACTED]');
  assert.equal(entry.nested.recoveryCode, '[REDACTED]');
  assert.ok(!JSON.stringify(entry).includes('hunter2'));
});

test('profile hides private login activity from other users', async () => {
  const erin = await registerAndLogin('erin');
  const frank = await registerAndLogin('frank');

  const own = await erin.agent.request('GET', '/api/auth/profile');
  assert.equal(own.status, 200);
  assert.ok(own.body.user.userAgentString);
  assert.equal(own.body.user.mfa, undefined);

  const other = await erin.agent.request('GET', `/api/auth/profile/${frank.id}`);
  assert.equal(other.status, 200);
  assert.equal(other.body.user.username, 'frank');
  assert.equal(other.body.user.userAgentString, undefined);
  assert.equal(other.body.user.mfaEnabled, undefined);

  assert.equal((await erin.agent.request('GET', '/api/auth/profile/not-an-id')).status, 400);
  assert.equal((await erin.agent.request('GET', `/api/auth/profile/${new mongoose.Types.ObjectId()}`)).status, 404);
});

test('todo CRUD, validation and ownership', async () => {
  const { agent: a } = await registerAndLogin('grace');
  const { agent: b } = await registerAndLogin('heidi');

  assert.equal((await a.request('POST', '/api/todos', { body: {} })).status, 400);
  assert.equal((await a.request('POST', '/api/todos', { body: { title: '   ' } })).status, 400);
  assert.equal((await a.request('POST', '/api/todos', { body: { title: ['x'] } })).status, 400);
  assert.equal((await a.request('POST', '/api/todos', { body: { title: 'x'.repeat(101) } })).status, 400);
  assert.equal((await a.request('POST', '/api/todos', { body: { title: 'ok', description: 5 } })).status, 400);

  const created = await a.request('POST', '/api/todos', { body: { title: '  Buy milk ', description: '2L' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.todo.title, 'Buy milk');
  assert.equal(created.body.todo.status, 'created');
  const id = created.body.todo.id;

  assert.equal((await a.request('GET', '/api/todos?status=bogus')).status, 400);
  assert.equal((await a.request('GET', '/api/todos?status=created')).body.count, 1);

  assert.equal((await a.request('PUT', `/api/todos/${id}`, { body: { status: 'nope' } })).status, 400);
  assert.equal((await a.request('PUT', `/api/todos/${id}`, { body: { title: '' } })).status, 400);
  assert.equal((await a.request('PUT', '/api/todos/bad-id', { body: { status: 'done' } })).status, 400);
  assert.equal((await b.request('PUT', `/api/todos/${id}`, { body: { status: 'done' } })).status, 404);

  const updated = await a.request('PUT', `/api/todos/${id}`, { body: { status: 'done' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.todo.status, 'done');
  assert.equal(updated.body.todo.title, 'Buy milk');

  assert.equal((await b.request('DELETE', `/api/todos/${id}`)).status, 404);
  assert.equal((await a.request('DELETE', `/api/todos/${id}`)).status, 200);
  assert.equal((await a.request('DELETE', `/api/todos/${id}`)).status, 404);
});

test('about me create/update/validation', async () => {
  const { agent } = await registerAndLogin('ivan');

  assert.equal((await agent.request('GET', '/api/allaboutme')).status, 404);
  assert.equal((await agent.request('POST', '/api/allaboutme', { body: {} })).status, 400, 'name is required');
  assert.equal((await agent.request('POST', '/api/allaboutme', { body: { name: { $gt: '' } } })).status, 400);

  const created = await agent.request('POST', '/api/allaboutme', {
    body: { name: 'Ivan', favoriteColor: 'blue', username: 'hacker', isAdmin: true }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.aboutMe.username, 'ivan');
  assert.equal(created.body.aboutMe.isAdmin, undefined);

  const updated = await agent.request('POST', '/api/allaboutme', { body: { favoriteFood: 'pizza' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.aboutMe.name, 'Ivan');
  assert.equal(updated.body.aboutMe.favoriteFood, 'pizza');

  assert.equal((await agent.request('POST', '/api/allaboutme', { body: { name: null } })).status, 400);
});

test('player profile details and avatar upload', async () => {
  const ivan = await registerAndLogin('ivan2');
  const judy = await registerAndLogin('judy');
  const a = ivan.agent;

  assert.equal((await a.request('PUT', '/api/auth/profile', { body: {} })).status, 400);
  assert.equal((await a.request('PUT', '/api/auth/profile', { body: { bio: 5 } })).status, 400);
  assert.equal((await a.request('PUT', '/api/auth/profile', { body: { displayName: 'x'.repeat(51) } })).status, 400);
  const updated = await a.request('PUT', '/api/auth/profile', {
    body: { displayName: 'Ivan The Great', country: 'Thailand', position: 'Striker', username: 'hacker' }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.user.username, 'ivan2');
  assert.equal(updated.body.user.profile.displayName, 'Ivan The Great');
  const cleared = await a.request('PUT', '/api/auth/profile', { body: { country: null } });
  assert.equal(cleared.body.user.profile.country, null);
  assert.equal(cleared.body.user.profile.position, 'Striker');

  const upload = (bytes, name = 'a.png') => {
    const form = new FormData();
    form.append('avatar', new Blob([bytes]), name);
    return a.request('POST', '/api/auth/profile/avatar', { form });
  };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

  assert.equal((await upload(Buffer.from('<script>alert(1)</script>'), 'evil.png')).status, 400);
  assert.equal((await upload(Buffer.alloc(2 * 1024 * 1024 + 1, 0xff))).status, 400);

  const first = await upload(png);
  assert.equal(first.status, 200);
  assert.match(first.body.avatarUrl, /^\/uploads\/avatars\/[0-9a-f-]+\.png$/);
  const img = await fetch(baseUrl + first.body.avatarUrl);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');

  const second = await upload(png);
  assert.notEqual(second.body.avatarUrl, first.body.avatarUrl);
  assert.equal((await fetch(baseUrl + first.body.avatarUrl)).status, 404);

  const seen = await judy.agent.request('GET', `/api/auth/profile/${ivan.id}`);
  assert.equal(seen.body.user.avatarUrl, second.body.avatarUrl);
  assert.equal(seen.body.user.profile.displayName, 'Ivan The Great');

  assert.equal((await a.request('DELETE', '/api/auth/profile/avatar')).status, 200);
  assert.equal((await fetch(baseUrl + second.body.avatarUrl)).status, 404);
  assert.equal((await a.request('DELETE', '/api/auth/profile/avatar')).status, 404);
});
