const request = require('supertest');
require('./helpers/aspektMock'); // installs jest.mock for aspektClient

const makeApp = require('./helpers/app');
const { resetDb, closeDb } = require('./helpers/db');
const { createUserWithToken, bearer } = require('./helpers/auth');

let app;

beforeAll(() => { app = makeApp(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await closeDb(); });

describe('POST /api/auth/register', () => {
  test('creates a staff user (default role)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@test.com', password: 'Password123', fullName: 'A' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'a@test.com', role: 'staff', full_name: 'A', is_active: true });
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('creates an admin user when role=admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.com', password: 'Password123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('admin');
  });

  test('400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'b@test.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8/);
  });

  test('400 when role is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'c@test.com', password: 'Password123', role: 'superuser' });
    expect(res.status).toBe(400);
  });

  test('400 when email or password missing', async () => {
    expect((await request(app).post('/api/auth/register').send({ password: 'Password123' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ email: 'd@test.com' })).status).toBe(400);
  });

  test('409 on duplicate email (case-insensitive)', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@test.com', password: 'Password123' });
    const res = await request(app).post('/api/auth/register').send({ email: 'DUP@TEST.COM', password: 'Password123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('returns a JWT for valid credentials', async () => {
    await request(app).post('/api/auth/register').send({ email: 'u@test.com', password: 'Password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ email: 'u@test.com', role: 'staff' });
  });

  test('401 on wrong password', async () => {
    await request(app).post('/api/auth/register').send({ email: 'u@test.com', password: 'Password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: 'WrongPw1234' });
    expect(res.status).toBe(401);
  });

  test('401 on unknown email (no user enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'Password123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  test('401 when account is deactivated', async () => {
    const { user } = await createUserWithToken({ email: 'inactive@test.com' });
    const { db } = require('./helpers/db');
    await db.query('UPDATE auth_users SET is_active = false WHERE id = $1', [user.id]);
    const res = await request(app).post('/api/auth/login').send({ email: 'inactive@test.com', password: 'Password123' });
    expect(res.status).toBe(401);
  });

  test('400 when fields missing', async () => {
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  test('returns the authenticated user', async () => {
    const { user, token } = await createUserWithToken({ email: 'me@test.com' });
    const res = await request(app).get('/api/auth/me').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, email: 'me@test.com', role: 'staff' });
  });

  test('401 without token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  test('401 with malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  test('401 with token signed by a different secret', async () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign({ sub: 1, role: 'staff' }, 'different-secret', { expiresIn: '1h' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${bad}`);
    expect(res.status).toBe(401);
  });
});
