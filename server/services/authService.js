const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../utils/db');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const VALID_ROLES = ['staff', 'admin'];

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
      ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
    }
  );
}

function publicUser(u) {
  return { id: u.id, email: u.email, full_name: u.full_name, role: u.role };
}

async function register({ email, password, fullName, role }) {
  if (!email || typeof email !== 'string') throw httpError(400, 'email is required');
  if (!password || typeof password !== 'string') throw httpError(400, 'password is required');
  if (password.length < 8) throw httpError(400, 'password must be at least 8 characters');
  if (role && !VALID_ROLES.includes(role)) throw httpError(400, `role must be one of ${VALID_ROLES.join(', ')}`);

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.query('SELECT id FROM auth_users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) throw httpError(409, 'email already registered');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await db.query(
    `INSERT INTO auth_users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, COALESCE($4, 'staff'))
     RETURNING id, email, full_name, role, is_active, created_at`,
    [normalizedEmail, passwordHash, fullName ?? null, role ?? null]
  );
  return rows[0];
}

async function login({ email, password }) {
  if (!email || !password) throw httpError(400, 'email and password are required');

  const { rows } = await db.query(
    `SELECT id, email, password_hash, full_name, role, is_active
       FROM auth_users
      WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  if (!user || !user.is_active) throw httpError(401, 'invalid credentials');

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) throw httpError(401, 'invalid credentials');

  await db.query(`UPDATE auth_users SET last_login_at = now() WHERE id = $1`, [user.id]);

  return {
    token: signToken(user),
    expiresIn: JWT_EXPIRES_IN,
    user: publicUser(user),
  };
}

async function me(userId) {
  const { rows } = await db.query(
    `SELECT id, email, full_name, role, is_active, created_at, last_login_at
       FROM auth_users
      WHERE id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

module.exports = { register, login, me };
