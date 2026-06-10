const db = require('../utils/db');

const CUSTOMER_COLUMNS = `
  contact_id, contact_code, personal_number,
  first_name, last_name, birth_date,
  mobile, address, email,
  is_active, registration_date, last_updated
`;

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

// WORKAROUND: `users.mobile` is NOT NULL in prod, but some Aspekt contacts have
// no mobile (so OTP login / mirroring would crash on insert). Until the column
// is made nullable in prod (see schema.sql), we hardset this placeholder.
// TODO(prod): ALTER TABLE users ALTER COLUMN mobile DROP NOT NULL, then remove this.
const MOBILE_PLACEHOLDER = 'N/A';
function normalizeMobile(mobile) {
  return mobile && String(mobile).trim() ? String(mobile).trim() : MOBILE_PLACEHOLDER;
}

function parseActiveFilter(value) {
  if (value === undefined || value === null || value === '' || value === 'all') return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  throw httpError(400, 'active must be "true", "false", or "all"');
}

async function listCustomers({ search, active, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const isActive = parseActiveFilter(active);

  const where = [];
  const params = [];

  if (isActive !== undefined) {
    params.push(isActive);
    where.push(`is_active = $${params.length}`);
  }

  if (search && String(search).trim() !== '') {
    params.push(`%${String(search).trim()}%`);
    const i = params.length;
    where.push(`(
      personal_number ILIKE $${i}
      OR contact_code  ILIKE $${i}
      OR first_name    ILIKE $${i}
      OR last_name     ILIKE $${i}
      OR mobile        ILIKE $${i}
      OR email         ILIKE $${i}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(safeLimit, safeOffset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const itemsQ = db.query(
    `SELECT ${CUSTOMER_COLUMNS},
            (SELECT COUNT(*)::int FROM leads             l WHERE l.contact_id = u.contact_id) AS lead_count,
            (SELECT COUNT(*)::int FROM loan_applications a WHERE a.contact_id = u.contact_id) AS application_count
       FROM users u
       ${whereSql}
       ORDER BY u.registration_date DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const countQ = db.query(
    `SELECT COUNT(*)::int AS total FROM users u ${whereSql}`,
    params.slice(0, params.length - 2)
  );

  const summaryQ = db.query(
    `SELECT
       COUNT(*)::int                                       AS total,
       COUNT(*) FILTER (WHERE is_active)::int              AS active,
       COUNT(*) FILTER (WHERE NOT is_active)::int          AS inactive
     FROM users`
  );

  const [items, count, summary] = await Promise.all([itemsQ, countQ, summaryQ]);

  return {
    items: items.rows,
    total: count.rows[0].total,
    limit: safeLimit,
    offset: safeOffset,
    summary: summary.rows[0],
  };
}

async function getCustomerById(contactId) {
  const { rows } = await db.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM users WHERE contact_id = $1`,
    [contactId]
  );
  if (rows.length === 0) return null;
  const customer = rows[0];

  const [imagesQ, leadsQ, appsQ] = await Promise.all([
    db.query(
      `SELECT id, image_type, image_path, uploaded_at
         FROM user_images
        WHERE contact_id = $1
        ORDER BY uploaded_at DESC`,
      [contactId]
    ),
    db.query(
      `SELECT lead_id, lead_number, status, loan_amount, priority, created_at, updated_at
         FROM leads
        WHERE contact_id = $1
        ORDER BY created_at DESC`,
      [contactId]
    ),
    db.query(
      `SELECT id, application_number, product_code, amount, number_of_installments,
              loan_number, status, created_at, updated_at
         FROM loan_applications
        WHERE contact_id = $1
        ORDER BY created_at DESC`,
      [contactId]
    ),
  ]);

  return {
    ...customer,
    images: imagesQ.rows,
    leads: leadsQ.rows,
    applications: appsQ.rows,
  };
}

async function setActive(contactId, isActive) {
  if (typeof isActive !== 'boolean') {
    throw httpError(400, 'isActive must be a boolean');
  }
  const { rows } = await db.query(
    `UPDATE users
        SET is_active   = $1,
            last_updated = now()
      WHERE contact_id = $2
      RETURNING contact_id, personal_number, is_active, last_updated`,
    [isActive, contactId]
  );
  return rows[0] ?? null;
}

// Convert "dd.mm.yyyy" -> ISO "yyyy-mm-dd". Pass-through if already ISO.
function toIsoBirthDate(value) {
  if (!value) return null;
  const dmy = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return value;
}

// Builds a short, unique placeholder that fits VARCHAR(20). Only used until
// the real contact_id is known and a derived "C-XXXXXXXX" code is written.
function buildTempContactCode() {
  return `T-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
}

async function createOrUpdateCustomer({
  contactCode,
  personalNumber,
  firstName,
  lastName,
  birthDate,
  mobile,
  address,
  email,
}) {
  if (!personalNumber) throw httpError(400, 'personalNumber is required');

  const isoBirthDate = toIsoBirthDate(birthDate);
  const tempCode = contactCode || buildTempContactCode();

  const { rows } = await db.query(
    `INSERT INTO users (
       contact_code, personal_number, first_name, last_name, birth_date,
       mobile, address, email, registration_date
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (personal_number) DO UPDATE
       SET first_name   = EXCLUDED.first_name,
           last_name    = EXCLUDED.last_name,
           birth_date   = COALESCE(EXCLUDED.birth_date, users.birth_date),
           -- Don't clobber a real stored mobile with the placeholder.
           mobile       = CASE
                            WHEN EXCLUDED.mobile = $10 THEN users.mobile
                            ELSE EXCLUDED.mobile
                          END,
           address      = COALESCE(EXCLUDED.address, users.address),
           email        = COALESCE(EXCLUDED.email,   users.email),
           contact_code = CASE
                            WHEN $9::text IS NOT NULL THEN $9
                            ELSE users.contact_code
                          END,
           last_updated = now()
     RETURNING contact_id, contact_code, (xmax = 0) AS inserted`,
    [tempCode, personalNumber, firstName, lastName, isoBirthDate,
     normalizeMobile(mobile), address ?? null, email ?? null, contactCode ?? null,
     MOBILE_PLACEHOLDER]
  );

  const { contact_id: id, contact_code: code, inserted } = rows[0];

  // Replace our placeholder with the derived "C-00000123" form once we have the id.
  if (inserted && !contactCode) {
    const derived = `C-${String(id).padStart(8, '0')}`;
    await db.query(
      `UPDATE users SET contact_code = $1 WHERE contact_id = $2`,
      [derived, id]
    );
    return { contact_id: id, contact_code: derived, inserted: true };
  }

  return { contact_id: id, contact_code: code, inserted };
}

async function attachUserImages(contactId, images = []) {
  for (const img of images) {
    if (!img || !img.type || !img.path) continue;
    await db.query(
      `INSERT INTO user_images (contact_id, image_type, image_path)
       VALUES ($1, $2, $3)
       ON CONFLICT (contact_id, image_type) DO UPDATE
         SET image_path  = EXCLUDED.image_path,
             uploaded_at = now()`,
      [contactId, img.type, img.path]
    );
  }
}

module.exports = {
  listCustomers,
  getCustomerById,
  setActive,
  createOrUpdateCustomer,
  attachUserImages,
};
