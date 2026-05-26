const db = require('../utils/db');

const VALID_STATUSES = ['New', 'Active', 'Qualified', 'Converted', 'Closed', 'Lost'];

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

// Extract a personal number from the Aspekt createLead request body, looking
// at PersonalNumber (top-level) and LeadDdc entries with keys like
// personalNumber / personal_number / uniqueId.
function extractPersonalNumber(body) {
  if (body?.PersonalNumber) return String(body.PersonalNumber);
  if (Array.isArray(body?.LeadDdc)) {
    const entry = body.LeadDdc.find(d =>
      d?.Key && /personal[_ ]?number|personalid|uniqueid/i.test(d.Key)
    );
    if (entry?.Value !== undefined && entry?.Value !== null) {
      return String(entry.Value);
    }
  }
  return null;
}

// ------------------------------------------------------------------
// Persistence (called by POST /create after Aspekt success)
// ------------------------------------------------------------------

async function persistLead({ requestBody, aspektBody, createdByAuthUserId, createdByContactId }) {
  const leadId = aspektBody?.LeadId;
  const leadNumber = aspektBody?.LeadNumber;
  if (!leadId || !leadNumber) {
    throw new Error('Cannot persist lead: missing LeadId or LeadNumber from Aspekt response');
  }
  const creators = [createdByAuthUserId, createdByContactId].filter((v) => v != null);
  if (creators.length !== 1) {
    throw new Error('Cannot persist lead: exactly one of createdByAuthUserId / createdByContactId must be set');
  }

  const personalNumber = extractPersonalNumber(requestBody);

  // contact_id (link to a known customer profile) is derived from the personal_number
  // for staff-created leads; for customer-created leads it's the JWT's contact_id.
  let contactId = createdByContactId ?? null;
  if (contactId == null && personalNumber) {
    const c = await db.query(
      `SELECT contact_id FROM users WHERE personal_number = $1`,
      [personalNumber]
    );
    if (c.rows[0]) contactId = c.rows[0].contact_id;
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO leads
         (lead_id, lead_number, created_by_auth_user_id, created_by_contact_id,
          contact_id, personal_number,
          name, mobile, email,
          place_code, lead_source_code, lead_category_code,
          loan_amount, priority, note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (lead_id) DO NOTHING`,
      [
        leadId,
        leadNumber,
        createdByAuthUserId ?? null,
        createdByContactId ?? null,
        contactId,
        personalNumber,
        requestBody.Name,
        requestBody.Mobile,
        requestBody.Email,
        requestBody.PlaceCode,
        requestBody.LeadSourceCode,
        requestBody.LeadCategoryCode || null,
        Number(requestBody.LoanAmount) || 0,
        requestBody.Priority || 'Normal',
        requestBody.Note || null,
        'New',
      ]
    );

    if (Array.isArray(requestBody.InterestedInProducts)) {
      for (const p of requestBody.InterestedInProducts) {
        if (!p?.ProductCode) continue;
        await client.query(
          `INSERT INTO lead_products (lead_id, product_code) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [leadId, p.ProductCode]
        );
      }
    }

    if (Array.isArray(requestBody.LeadDdc)) {
      for (const d of requestBody.LeadDdc) {
        if (!d?.Key) continue;
        await client.query(
          `INSERT INTO lead_ddc (lead_id, ddc_key, ddc_value) VALUES ($1, $2, $3)
           ON CONFLICT (lead_id, ddc_key) DO UPDATE SET ddc_value = EXCLUDED.ddc_value`,
          [leadId, d.Key, d.Value !== undefined && d.Value !== null ? String(d.Value) : null]
        );
      }
    }

    await client.query('COMMIT');
    return { leadId, leadNumber, persisted: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------------
// Queries (back the GET endpoints)
// ------------------------------------------------------------------

async function listLeads({ status, search, createdByAuthUserId, createdByContactId, limit = 50, offset = 0 } = {}) {
  if (status && !VALID_STATUSES.includes(status)) {
    throw httpError(400, `status must be one of ${VALID_STATUSES.join(', ')}`);
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const where = [];
  const params = [];

  if (createdByAuthUserId !== undefined && createdByAuthUserId !== null) {
    params.push(createdByAuthUserId);
    where.push(`created_by_auth_user_id = $${params.length}`);
  }

  if (createdByContactId !== undefined && createdByContactId !== null) {
    params.push(createdByContactId);
    where.push(`created_by_contact_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  if (search && String(search).trim() !== '') {
    params.push(`%${String(search).trim()}%`);
    const i = params.length;
    where.push(`(
      lead_number     ILIKE $${i}
      OR name         ILIKE $${i}
      OR mobile       ILIKE $${i}
      OR email        ILIKE $${i}
      OR personal_number ILIKE $${i}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(safeLimit, safeOffset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const itemsQ = db.query(
    `SELECT lead_id, lead_number, created_by_auth_user_id, created_by_contact_id,
            contact_id, personal_number,
            name, mobile, email,
            place_code, lead_source_code, lead_category_code,
            loan_amount, priority, status, note,
            created_at, updated_at
       FROM leads
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const countQ = db.query(
    `SELECT COUNT(*)::int AS total FROM leads ${whereSql}`,
    params.slice(0, params.length - 2)
  );

  const [items, count] = await Promise.all([itemsQ, countQ]);

  return {
    items: items.rows,
    total: count.rows[0].total,
    limit: safeLimit,
    offset: safeOffset,
  };
}

async function listLeadsByPersonalNumber(personalNumber) {
  const { rows } = await db.query(
    `SELECT lead_id, lead_number, contact_id, personal_number,
            name, mobile, email,
            place_code, lead_source_code, lead_category_code,
            loan_amount, priority, status, note,
            created_at, updated_at
       FROM leads
      WHERE personal_number = $1
      ORDER BY created_at DESC`,
    [personalNumber]
  );
  return rows;
}

async function getLeadById(idOrNumber) {
  // Path param is :leadId — accept either an integer lead_id or a lead_number string.
  let row = null;
  const asInt = Number(idOrNumber);
  if (Number.isInteger(asInt) && asInt > 0) {
    const r = await db.query(
      `SELECT * FROM leads WHERE lead_id = $1`,
      [asInt]
    );
    row = r.rows[0] ?? null;
  }
  if (!row) {
    const r = await db.query(
      `SELECT * FROM leads WHERE lead_number = $1`,
      [String(idOrNumber)]
    );
    row = r.rows[0] ?? null;
  }
  if (!row) return null;

  const [products, ddc] = await Promise.all([
    db.query(
      `SELECT product_code FROM lead_products WHERE lead_id = $1 ORDER BY product_code`,
      [row.lead_id]
    ),
    db.query(
      `SELECT ddc_key, ddc_value FROM lead_ddc WHERE lead_id = $1 ORDER BY ddc_key`,
      [row.lead_id]
    ),
  ]);

  return {
    ...row,
    interested_in_products: products.rows.map(r => r.product_code),
    ddc: ddc.rows,
  };
}

async function updateLeadStatus(idOrNumber, status) {
  if (typeof status !== 'string' || !status.trim()) {
    throw httpError(400, 'status is required');
  }
  if (!VALID_STATUSES.includes(status)) {
    throw httpError(400, `status must be one of ${VALID_STATUSES.join(', ')}`);
  }

  // Match either lead_id (int) or lead_number (string).
  const asInt = Number(idOrNumber);
  let result;
  if (Number.isInteger(asInt) && asInt > 0) {
    result = await db.query(
      `UPDATE leads
          SET status = $1,
              updated_at = now()
        WHERE lead_id = $2
        RETURNING lead_id, lead_number, status, updated_at`,
      [status, asInt]
    );
  }
  if (!result || result.rowCount === 0) {
    result = await db.query(
      `UPDATE leads
          SET status = $1,
              updated_at = now()
        WHERE lead_number = $2
        RETURNING lead_id, lead_number, status, updated_at`,
      [status, String(idOrNumber)]
    );
  }
  return result.rows[0] ?? null;
}

module.exports = {
  VALID_STATUSES,
  persistLead,
  listLeads,
  listLeadsByPersonalNumber,
  getLeadById,
  updateLeadStatus,
};
