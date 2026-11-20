// Integration tests. Requires a reachable MongoDB; uses a throwaway database.
//   MONGODB_URI_TEST=mongodb://127.0.0.1:27017/auth_test npm test
process.env.JWT_SECRET = process.env.JWT_SECRET_TEST || 'test-secret';
process.env.CORS_ORIGIN = '*';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');

const MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/auth_test';

let server;
let baseUrl;

const api = async (method, path, { body, token, headers = {} } = {}) => {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
};

const registerAndLogin = async (username, password = 'secret123') => {
  await api('POST', '/api/auth/register', { body: { username, password } });
  const res = await api('POST', '/api/auth/login', { body: { username, password } });
  return { token: res.body.token, id: res.body.user.id };
};

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
});

test('health check and 404', async () => {
  assert.equal((await api('GET', '/')).status, 200);
  assert.equal((await api('GET', '/nope')).status, 404);
  assert.equal((await api('GET', '/')).headers.get('x-powered-by'), null);
});

test('register validation and duplicates', async () => {
  assert.equal((await api('POST', '/api/auth/register', { body: {} })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { body: { username: 'ab', password: 'secret123' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { body: { username: 'alice', password: '123' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { body: { username: { $ne: 1 }, password: 'secret123' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { body: '{bad json' })).status, 400);

  const ok = await api('POST', '/api/auth/register', { body: { username: 'alice', password: 'secret123' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.password, undefined);
  assert.equal((await api('POST', '/api/auth/register', { body: { username: 'alice', password: 'secret123' } })).status, 409);
});

test('login, lockout and spoofed X-Forwarded-For', async () => {
  await api('POST', '/api/auth/register', { body: { username: 'bob', password: 'secret123' } });

  assert.equal((await api('POST', '/api/auth/login', { body: { username: 'ghost', password: 'x' } })).status, 401);

  const good = await api('POST', '/api/auth/login', {
    body: { username: 'bob', password: 'secret123' },
    headers: { 'X-Forwarded-For': '6.6.6.6' }
  });
  assert.equal(good.status, 200);
  assert.ok(good.body.token);
  assert.notEqual(good.body.userAgent.ipAddress, '6.6.6.6', 'IP must not be spoofable without trust proxy');

  for (let i = 1; i <= 4; i++) {
    const r = await api('POST', '/api/auth/login', { body: { username: 'bob', password: 'wrong' } });
    assert.equal(r.status, 401);
    assert.equal(r.body.remainingAttempts, 5 - i);
  }
  assert.equal((await api('POST', '/api/auth/login', { body: { username: 'bob', password: 'wrong' } })).status, 403);
  assert.equal((await api('POST', '/api/auth/login', { body: { username: 'bob', password: 'secret123' } })).status, 403);
});

test('legacy bcrypt hashes still log in and get upgraded to argon2', async () => {
  const bcrypt = require('bcryptjs');
  const User = require('../src/models/user.model');
  await User.create({ username: 'legacy', password: await bcrypt.hash('secret123', 8) });

  assert.equal((await api('POST', '/api/auth/login', { body: { username: 'legacy', password: 'secret123' } })).status, 200);
  const user = await User.findOne({ username: 'legacy' });
  assert.ok(user.password.startsWith('$argon2'));
  assert.equal((await api('POST', '/api/auth/login', { body: { username: 'legacy', password: 'secret123' } })).status, 200);
});

test('auth middleware', async () => {
  assert.equal((await api('GET', '/api/todos')).status, 401);
  assert.equal((await api('GET', '/api/todos', { token: 'garbage' })).status, 401);
  const { token } = await registerAndLogin('carol');
  const wrongScheme = await api('GET', '/api/todos', { headers: { Authorization: `Basic ${token}` } });
  assert.equal(wrongScheme.status, 401);
  assert.equal((await api('GET', '/api/todos', { token })).status, 200);
});

test('profile hides private login activity from other users', async () => {
  const dave = await registerAndLogin('dave');
  const erin = await registerAndLogin('erin');

  const own = await api('GET', '/api/auth/profile', { token: dave.token });
  assert.equal(own.status, 200);
  assert.ok(own.body.user.userAgentString);

  const other = await api('GET', `/api/auth/profile/${erin.id}`, { token: dave.token });
  assert.equal(other.status, 200);
  assert.equal(other.body.user.username, 'erin');
  assert.equal(other.body.user.userAgentString, undefined);
  assert.equal(other.body.user.login_status, undefined);

  assert.equal((await api('GET', '/api/auth/profile/not-an-id', { token: dave.token })).status, 400);
  assert.equal((await api('GET', `/api/auth/profile/${new mongoose.Types.ObjectId()}`, { token: dave.token })).status, 404);
});

test('todo CRUD, validation and ownership', async () => {
  const frank = await registerAndLogin('frank');
  const grace = await registerAndLogin('grace');

  assert.equal((await api('POST', '/api/todos', { token: frank.token, body: {} })).status, 400);
  assert.equal((await api('POST', '/api/todos', { token: frank.token, body: { title: '   ' } })).status, 400);
  assert.equal((await api('POST', '/api/todos', { token: frank.token, body: { title: ['x'] } })).status, 400);
  assert.equal((await api('POST', '/api/todos', { token: frank.token, body: { title: 'x'.repeat(101) } })).status, 400);
  assert.equal((await api('POST', '/api/todos', { token: frank.token, body: { title: 'ok', description: 5 } })).status, 400);

  const created = await api('POST', '/api/todos', { token: frank.token, body: { title: '  Buy milk ', description: '2L' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.todo.title, 'Buy milk');
  assert.equal(created.body.todo.status, 'created');
  const id = created.body.todo.id;

  assert.equal((await api('GET', '/api/todos?status=bogus', { token: frank.token })).status, 400);
  const list = await api('GET', '/api/todos?status=created', { token: frank.token });
  assert.equal(list.body.count, 1);

  assert.equal((await api('PUT', `/api/todos/${id}`, { token: frank.token, body: { status: 'nope' } })).status, 400);
  assert.equal((await api('PUT', `/api/todos/${id}`, { token: frank.token, body: { title: '' } })).status, 400);
  assert.equal((await api('PUT', '/api/todos/bad-id', { token: frank.token, body: { status: 'done' } })).status, 400);
  assert.equal((await api('PUT', `/api/todos/${id}`, { token: grace.token, body: { status: 'done' } })).status, 404);

  const updated = await api('PUT', `/api/todos/${id}`, { token: frank.token, body: { status: 'done' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.todo.status, 'done');
  assert.equal(updated.body.todo.title, 'Buy milk');

  assert.equal((await api('DELETE', `/api/todos/${id}`, { token: grace.token })).status, 404);
  assert.equal((await api('DELETE', `/api/todos/${id}`, { token: frank.token })).status, 200);
  assert.equal((await api('DELETE', `/api/todos/${id}`, { token: frank.token })).status, 404);
});

test('about me create/update/validation', async () => {
  const { token } = await registerAndLogin('heidi');

  assert.equal((await api('GET', '/api/allaboutme', { token })).status, 404);
  assert.equal((await api('POST', '/api/allaboutme', { token, body: {} })).status, 400, 'name is required');
  assert.equal((await api('POST', '/api/allaboutme', { token, body: { name: { $gt: '' } } })).status, 400);

  const created = await api('POST', '/api/allaboutme', {
    token,
    body: { name: 'Heidi', favoriteColor: 'blue', username: 'hacker', isAdmin: true }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.aboutMe.username, 'heidi');
  assert.equal(created.body.aboutMe.isAdmin, undefined);

  const updated = await api('POST', '/api/allaboutme', { token, body: { favoriteFood: 'pizza' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.aboutMe.name, 'Heidi');
  assert.equal(updated.body.aboutMe.favoriteColor, 'blue');
  assert.equal(updated.body.aboutMe.favoriteFood, 'pizza');

  assert.equal((await api('POST', '/api/allaboutme', { token, body: { name: null } })).status, 400);

  const got = await api('GET', '/api/allaboutme', { token });
  assert.equal(got.status, 200);
  assert.equal(got.body.aboutMe.favoriteFood, 'pizza');
});
