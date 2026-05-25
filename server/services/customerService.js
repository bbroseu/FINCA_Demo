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

module.exports = { listCustomers, getCustomerById, setActive };
