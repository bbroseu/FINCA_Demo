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

// Customer test user. Customers live in the `users` table keyed by contact_id,
// not auth_users. JWT 'sub' must be the contact_id and role must be 'customer'.
async function createCustomerWithToken({
  contactCode = `C${Math.floor(Math.random() * 1e9)}`,
  personalNumber = String(Math.floor(Math.random() * 1e10)).padStart(10, '0'),
  firstName = 'Test',
  lastName = 'Customer',
  mobile = '+38344000000',
  email = `c${Math.floor(Math.random() * 1e9)}@test.com`,
} = {}) {
  const { rows } = await db.query(
    `INSERT INTO users (contact_code, personal_number, first_name, last_name, mobile, email, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING contact_id, contact_code, personal_number, first_name, last_name, mobile, email, is_active`,
    [contactCode, personalNumber, firstName, lastName, mobile, email]
  );
  const customer = rows[0];
  const token = jwt.sign(
    { sub: customer.contact_id, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { customer, token };
}

module.exports = { createUser, tokenFor, createUserWithToken, createCustomerWithToken, bearer };
