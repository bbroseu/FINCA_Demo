const express = require('express');

const authService = require('../services/authService');
const requireJwt = require('../middleware/requireJwt');

const router = express.Router();

function sendError(res, err) {
  return res.status(err.statusCode || 500).json({ error: err.message });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const user = await authService.register({
      email: req.body?.email,
      password: req.body?.password,
      fullName: req.body?.fullName ?? req.body?.full_name,
      role: req.body?.role,
    });
    return res.status(201).json(user);
  } catch (err) {
    return sendError(res, err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const result = await authService.login({
      email: req.body?.email,
      password: req.body?.password,
    });
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// GET /api/auth/me — handy for verifying the token in dev
router.get('/me', requireJwt, async (req, res) => {
  try {
    const user = await authService.me(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
