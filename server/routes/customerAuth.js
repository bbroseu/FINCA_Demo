const express = require('express');

const customerAuthService = require('../services/customerAuthService');
const requireCustomerJwt = require('../middleware/requireCustomerJwt');

const router = express.Router();

function sendError(res, err) {
  return res.status(err.statusCode || 500).json({ error: err.message });
}

// POST /api/customer/auth/request-otp
// Body: { personalNumber }
// Always responds 200 (doesn't leak whether the number is registered).
router.post('/request-otp', async (req, res) => {
  try {
    const result = await customerAuthService.requestOtp({
      personalNumber: req.body?.personalNumber,
    });
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// POST /api/customer/auth/verify-otp
// Body: { personalNumber, code }
// Returns { token, expiresIn, customer }.
router.post('/verify-otp', async (req, res) => {
  try {
    const result = await customerAuthService.verifyOtp({
      personalNumber: req.body?.personalNumber,
      code: req.body?.code,
    });
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// GET /api/customer/auth/me
router.get('/me', requireCustomerJwt, async (req, res) => {
  try {
    const profile = await customerAuthService.getProfile(req.customer.contact_id);
    if (!profile) return res.status(404).json({ error: 'Customer not found' });
    return res.json(customerAuthService.publicCustomer(profile));
  } catch (err) {
    return sendError(res, err);
  }
});

// GET /api/customer/auth/profile
// The authenticated customer's own full profile: local row enriched with the
// authoritative Aspekt contact details (birth date, address, current mobile).
// Always scoped to the caller's own contact_id from the JWT.
router.get('/profile', requireCustomerJwt, async (req, res) => {
  try {
    const profile = await customerAuthService.getOwnProfile(req.customer.contact_id);
    if (!profile) return res.status(404).json({ error: 'Customer not found' });
    return res.json(profile);
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
