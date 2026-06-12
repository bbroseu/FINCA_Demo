const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');

const db = require('../utils/db');
const aspektClient = require('../middleware/aspektClient');
const customerService = require('./customerService');

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

// Authoritative existence check against the Aspekt core banking system.
// Returns the contact object when the person exists, or null when they don't.
// Throws a 502 on a genuine API failure so a transient outage doesn't get
// mistaken for "no such person" (which would silently block every login).
async function lookupAspektContact(personalNumber) {
  const requestId = uuid();
  try {
    const response = await aspektClient.get(`/api/getContact/${requestId}`, {
      data: { Alias: personalNumber },
    });
    if (response.status === 200) {
      const body = response.data?.Body;
      return Array.isArray(body) && body.length > 0 ? body[0] : null;
    }
    if (response.status === 402) return null; // CBS "contact not found"
    throw httpError(502, 'contact lookup failed');
  } catch (err) {
    // Aspekt signals "no such contact" with a 402 (some envs return 404).
    const status = err.response?.status;
    if (status === 402 || status === 404) return null;
    if (err.statusCode) throw err; // our own httpError, re-raise as-is
    throw httpError(502, 'contact lookup failed');
  }
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

  const alias = personalNumber.trim();

  // Existence is decided by Aspekt (the source of truth), not the local cache.
  const contact = await lookupAspektContact(alias);

  // Don't leak which numbers exist — always respond as if we sent.
  if (!contact) {
    return { sent: true, ttl: OTP_TTL_SECONDS };
  }

  // Mirror the Aspekt contact into the local users table so we have a
  // contact_id to key the OTP (and later the JWT in verifyOtp) against.
  const { contact_id } = await customerService.createOrUpdateCustomer({
    contactCode: contact.ContactCode,
    // Key the local user on the alias the customer authenticates with — Aspekt
    // may decorate its PersonalNumber (e.g. an "asp_" prefix), and verifyOtp
    // looks the user up by the raw typed alias, so the two must match.
    personalNumber: alias,
    firstName: contact.FirstName,
    lastName: contact.LastName,
    birthDate: contact.BirthDate,
    mobile: contact.Mobile,
    address: contact.Address,
  });

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
    [contact_id, hash, expiresAt]
  );

  if (process.env.NODE_ENV !== 'production') {
    // Dev: log the code so you can test without an SMS gateway.
    console.log(`[customerAuth] OTP for ${alias} (mobile ${contact.Mobile}): ${code}`);
  }
  // TODO: integrate SMS gateway in production.

  // Return the code itself in dev so the mobile screen can display it while no
  // SMS gateway is wired up. Never leaked in production.
  return {
    sent: true,
    ttl: OTP_TTL_SECONDS,
    ...(process.env.NODE_ENV !== 'production' && { devCode: code }),
  };
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

// Builds the authenticated customer's own profile: the locally cached row
// enriched with the authoritative, fresher fields from Aspekt (birth date,
// address, current mobile). The Aspekt lookup is keyed on the customer's OWN
// personal_number taken from their JWT-backed users row — never a client-
// supplied alias — so a customer can only ever read their own record.
// If Aspekt is unreachable we still return the local data (a transient CBS
// outage shouldn't blank out the profile screen); `source` says which we used.
async function getOwnProfile(contactId) {
  const local = await getProfile(contactId);
  if (!local) return null;

  let contact = null;
  try {
    contact = await lookupAspektContact(local.personal_number);
  } catch (_) {
    // Swallow CBS errors here and fall back to the cached row below.
    contact = null;
  }

  return {
    ...publicCustomer(local),
    first_name: contact?.FirstName ?? local.first_name,
    last_name: contact?.LastName ?? local.last_name,
    mobile: contact?.Mobile ?? local.mobile,
    birth_date: contact?.BirthDate ?? null,
    address: contact?.Address ?? null,
    registration_date: local.registration_date,
    source: contact ? 'aspekt' : 'local',
  };
}

module.exports = {
  requestOtp,
  verifyOtp,
  getProfile,
  getOwnProfile,
  publicCustomer,
};
