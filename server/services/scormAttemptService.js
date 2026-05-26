const db = require('../utils/db');

const VALID_COMPLETION = ['unknown', 'not_attempted', 'incomplete', 'completed'];
const VALID_SUCCESS = ['unknown', 'passed', 'failed'];

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

const ATTEMPT_COLUMNS = `
  id, package_id, customer_contact_id, attempt_number,
  completion_status, success_status,
  score_raw, score_max,
  session_time_seconds, suspend_data,
  last_accessed_at
`;

// Start a new attempt OR resume the current incomplete one for
// (package_id, customer_contact_id). Returns the attempt row.
async function startOrResumeAttempt(packageId, customerContactId) {
  const pkg = await db.query(`SELECT id, course_id, status FROM scorm_packages WHERE id = $1`, [packageId]);
  if (pkg.rowCount === 0) throw httpError(404, 'Package not found');
  if (pkg.rows[0].status !== 'ready') throw httpError(409, `Package not ready (status: ${pkg.rows[0].status})`);

  const existing = await db.query(
    `SELECT ${ATTEMPT_COLUMNS}
       FROM scorm_tracking
      WHERE package_id = $1 AND customer_contact_id = $2
        AND completion_status <> 'completed'
      ORDER BY attempt_number DESC
      LIMIT 1`,
    [packageId, customerContactId]
  );
  if (existing.rowCount > 0) {
    await db.query(
      `UPDATE scorm_tracking SET last_accessed_at = now() WHERE id = $1`,
      [existing.rows[0].id]
    );
    return { ...existing.rows[0], resumed: true };
  }

  const next = await db.query(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS n
       FROM scorm_tracking
      WHERE package_id = $1 AND customer_contact_id = $2`,
    [packageId, customerContactId]
  );
  const attemptNumber = next.rows[0].n;

  const inserted = await db.query(
    `INSERT INTO scorm_tracking
       (package_id, customer_contact_id, attempt_number,
        completion_status, success_status,
        session_time_seconds, last_accessed_at)
     VALUES ($1, $2, $3, 'incomplete', 'unknown', 0, now())
     RETURNING ${ATTEMPT_COLUMNS}`,
    [packageId, customerContactId, attemptNumber]
  );
  return { ...inserted.rows[0], resumed: false };
}

async function getAttemptById(attemptId) {
  const { rows } = await db.query(
    `SELECT ${ATTEMPT_COLUMNS}
       FROM scorm_tracking WHERE id = $1`,
    [attemptId]
  );
  return rows[0] ?? null;
}

// PATCH semantics — only update fields the client sent. Accumulates session_time.
async function updateAttempt(attemptId, patch) {
  const sets = [];
  const params = [];

  if (patch.completion_status !== undefined) {
    if (!VALID_COMPLETION.includes(patch.completion_status)) {
      throw httpError(400, `completion_status must be one of ${VALID_COMPLETION.join(', ')}`);
    }
    params.push(patch.completion_status);
    sets.push(`completion_status = $${params.length}`);
  }

  if (patch.success_status !== undefined) {
    if (!VALID_SUCCESS.includes(patch.success_status)) {
      throw httpError(400, `success_status must be one of ${VALID_SUCCESS.join(', ')}`);
    }
    params.push(patch.success_status);
    sets.push(`success_status = $${params.length}`);
  }

  if (patch.score_raw !== undefined) {
    const n = patch.score_raw === null ? null : Number(patch.score_raw);
    if (n !== null && !Number.isFinite(n)) throw httpError(400, 'score_raw must be a number');
    params.push(n);
    sets.push(`score_raw = $${params.length}`);
  }

  if (patch.score_max !== undefined) {
    const n = patch.score_max === null ? null : Number(patch.score_max);
    if (n !== null && !Number.isFinite(n)) throw httpError(400, 'score_max must be a number');
    params.push(n);
    sets.push(`score_max = $${params.length}`);
  }

  // session_time_seconds is sent as a DELTA for this commit; we accumulate.
  if (patch.session_time_seconds !== undefined) {
    const n = Number(patch.session_time_seconds);
    if (!Number.isFinite(n) || n < 0) throw httpError(400, 'session_time_seconds must be a non-negative number');
    params.push(Math.floor(n));
    sets.push(`session_time_seconds = session_time_seconds + $${params.length}`);
  }

  if (patch.suspend_data !== undefined) {
    const v = patch.suspend_data === null ? null : String(patch.suspend_data);
    params.push(v);
    sets.push(`suspend_data = $${params.length}`);
  }

  sets.push(`last_accessed_at = now()`);

  params.push(attemptId);
  const { rows } = await db.query(
    `UPDATE scorm_tracking SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING ${ATTEMPT_COLUMNS}`,
    params
  );
  return rows[0] ?? null;
}

async function listAttemptsForCustomer(customerContactId) {
  const { rows } = await db.query(
    `SELECT t.id, t.package_id, t.customer_contact_id, t.attempt_number,
            t.completion_status, t.success_status,
            t.score_raw, t.score_max,
            t.session_time_seconds, t.last_accessed_at,
            p.title       AS package_title,
            p.scorm_version,
            p.entry_point,
            p.storage_path,
            c.id          AS course_id,
            c.title       AS course_title
       FROM scorm_tracking t
       JOIN scorm_packages p ON p.id = t.package_id
       JOIN courses        c ON c.id = p.course_id
      WHERE t.customer_contact_id = $1
      ORDER BY t.last_accessed_at DESC NULLS LAST, t.id DESC`,
    [customerContactId]
  );
  return rows;
}

module.exports = {
  startOrResumeAttempt,
  getAttemptById,
  updateAttempt,
  listAttemptsForCustomer,
};
