const jwt = require('jsonwebtoken');

const db = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

// Customer-scope JWT guard. Distinct from requireJwt (staff/admin) — accepts
// only tokens with role === 'customer' and loads the matching users-table row.
module.exports = async function requireCustomerJwt(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer (.+)$/);
    if (!m) return res.status(401).json({ error: 'Unauthorized' });

    let payload;
    try {
      payload = jwt.verify(m[1], JWT_SECRET, {
        ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
        ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
      });
    } catch (_) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (payload.role !== 'customer') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rows } = await db.query(
      `SELECT contact_id, contact_code, personal_number, first_name, last_name,
              mobile, email, is_active
         FROM users WHERE contact_id = $1`,
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.customer = user;
    next();
  } catch (err) {
    next(err);
  }
};
