const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('./db');

async function createUser({ email, password = 'Password123', fullName = null, role = 'staff' } = {}) {
  const passwordHash = await bcrypt.hash(password, 4); // low rounds for test speed
  const { rows } = await db.query(
    `INSERT INTO auth_users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role, is_active`,
    [email.toLowerCase(), passwordHash, fullName, role]
  );
  return rows[0];
}

function tokenFor(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function createUserWithToken(opts = {}) {
  const user = await createUser(opts);
  return { user, token: tokenFor(user) };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createUser, tokenFor, createUserWithToken, bearer };
