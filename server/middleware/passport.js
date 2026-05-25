const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

const db = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET is not set — using development fallback. Do not run this in production.');
}

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
  ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
  ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
};

passport.use(new JwtStrategy(opts, async (payload, done) => {
  try {
    const { rows } = await db.query(
      `SELECT id, email, full_name, role, is_active
         FROM auth_users
        WHERE id = $1`,
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) return done(null, false);
    return done(null, user);
  } catch (err) {
    return done(err, false);
  }
}));

module.exports = passport;
