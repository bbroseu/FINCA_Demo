const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function signCustomerToken(customer) {
  return jwt.sign(
    {
      sub: customer.contact_id,
      role: 'customer',
      personalNumber: customer.personal_number,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
      ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
    }
  );
}

function publicCustomer(c) {
  return {
    id: c.contact_id,
    contact_id: c.contact_id,
    contact_code: c.contact_code,
    personal_number: c.personal_number,
    first_name: c.first_name,
    last_name: c.last_name,
    mobile: c.mobile,
    email: c.email,
    role: 'customer',
  };
}

async function requestOtp({ personalNumber }) {
  if (!personalNumber || typeof personalNumber !== 'string') {
    throw httpError(400, 'personalNumber is required');
  }

  const { rows } = await db.query(
    `SELECT contact_id, personal_number, mobile, is_active
       FROM users WHERE personal_number = $1`,
    [personalNumber.trim()]
  );
  const user = rows[0];

  // Don't leak which numbers exist — always respond as if we sent.
  if (!user || !user.is_active) {
    return { sent: true, ttl: OTP_TTL_SECONDS };
  }

  const code = generateOtp();
  const hash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await db.query(
    `INSERT INTO customer_otp_codes (contact_id, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, 0, now())
     ON CONFLICT (contact_id) DO UPDATE
       SET code_hash  = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           attempts   = 0,
           created_at = now()`,
    [user.contact_id, hash, expiresAt]
  );

  if (process.env.NODE_ENV !== 'production') {
    // Dev: log the code so you can test without an SMS gateway.
    console.log(`[customerAuth] OTP for ${user.personal_number} (mobile ${user.mobile}): ${code}`);
  }
  // TODO: integrate SMS gateway in production.

  return { sent: true, ttl: OTP_TTL_SECONDS };
}

async function verifyOtp({ personalNumber, code }) {
  if (!personalNumber || !code) {
    throw httpError(400, 'personalNumber and code are required');
  }

  const { rows: userRows } = await db.query(
    `SELECT contact_id, contact_code, personal_number, first_name, last_name,
            mobile, email, is_active
       FROM users WHERE personal_number = $1`,
    [personalNumber.trim()]
  );
  const user = userRows[0];
  if (!user || !user.is_active) throw httpError(401, 'invalid code');

  const { rows: otpRows } = await db.query(
    `SELECT code_hash, expires_at, attempts
       FROM customer_otp_codes WHERE contact_id = $1`,
    [user.contact_id]
  );
  const otp = otpRows[0];
  if (!otp) throw httpError(401, 'invalid code');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw httpError(429, 'too many attempts');
  if (new Date(otp.expires_at).getTime() < Date.now()) throw httpError(401, 'code expired');

  const ok = await bcrypt.compare(String(code), otp.code_hash);
  if (!ok) {
    await db.query(
      `UPDATE customer_otp_codes SET attempts = attempts + 1 WHERE contact_id = $1`,
      [user.contact_id]
    );
    throw httpError(401, 'invalid code');
  }

  // Single-use: consume on success.
  await db.query(`DELETE FROM customer_otp_codes WHERE contact_id = $1`, [user.contact_id]);
  await db.query(
    `UPDATE users SET last_updated = now() WHERE contact_id = $1`,
    [user.contact_id]
  );

  return {
    token: signCustomerToken(user),
    expiresIn: JWT_EXPIRES_IN,
    customer: publicCustomer(user),
  };
}

async function getProfile(contactId) {
  const { rows } = await db.query(
    `SELECT contact_id, contact_code, personal_number, first_name, last_name,
            mobile, email, is_active, registration_date
       FROM users WHERE contact_id = $1`,
    [contactId]
  );
  return rows[0] ?? null;
}

module.exports = {
  requestOtp,
  verifyOtp,
  getProfile,
  publicCustomer,
};
