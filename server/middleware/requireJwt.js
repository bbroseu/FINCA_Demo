const passport = require('./passport');

// Wrapper around passport.authenticate that returns a JSON 401 instead of
// the default plaintext "Unauthorized" response.
module.exports = function requireJwt(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      const message = info?.message || 'Unauthorized';
      return res.status(401).json({ error: message });
    }
    req.user = user;
    next();
  })(req, res, next);
};
