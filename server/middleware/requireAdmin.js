// Role gate. Must run AFTER requireJwt has populated req.user.
module.exports = function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  next();
};
