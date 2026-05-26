const jwt = require('jsonwebtoken');

const db = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

// Accepts either a staff/admin token (payload.role === 'staff' | 'admin') or a
// customer token (payload.role === 'customer'). Loads the matching user row and
// exposes:
//   req.user      — auth_users row for staff/admin
//   req.customer  — users row for customers
//   req.actor     — unified marker { type, id, role?, personalNumber? }
//
// Routes that should be reachable by both kinds of caller should use this in
// place of the role-specific guards. For routes that take a customer-scoped
// path param (e.g. /:alias), follow up with an ownership check.
module.exports = async function requireAnyJwt(req, res, next) {
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

    if (payload.role === 'customer') {
      const { rows } = await db.query(
        `SELECT contact_id, contact_code, personal_number, first_name, last_name,
                mobile, email, is_active
           FROM users WHERE contact_id = $1`,
        [payload.sub]
      );
      const c = rows[0];
      if (!c || !c.is_active) return res.status(401).json({ error: 'Unauthorized' });

      req.customer = c;
      req.actor = {
        type: 'customer',
        id: c.contact_id,
        personalNumber: c.personal_number,
      };
      return next();
    }

    if (payload.role === 'staff' || payload.role === 'admin') {
      const { rows } = await db.query(
        `SELECT id, email, full_name, role, is_active
           FROM auth_users WHERE id = $1`,
        [payload.sub]
      );
      const u = rows[0];
      if (!u || !u.is_active) return res.status(401).json({ error: 'Unauthorized' });

      req.user = u;
      req.actor = { type: 'staff', id: u.id, role: u.role };
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
  } catch (err) {
    next(err);
  }
};
