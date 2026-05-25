const express = require('express');

const customerService = require('../services/customerService');
const requireJwt = require('../middleware/requireJwt');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Every admin route requires a valid JWT AND admin role.
router.use(requireJwt, requireAdmin);

function sendError(res, err) {
  return res.status(err.statusCode || 500).json({ error: err.message });
}

function parsePositiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

// GET /api/admin/customers?search=&active=true|false|all&limit=&offset=
router.get('/customers', async (req, res) => {
  try {
    const result = await customerService.listCustomers({
      search: req.query.search,
      active: req.query.active,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

// GET /api/admin/customers/:contactId
router.get('/customers/:contactId', async (req, res) => {
  try {
    const contactId = parsePositiveInt(req.params.contactId, 'contactId');
    const customer = await customerService.getCustomerById(contactId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.json(customer);
  } catch (err) {
    return sendError(res, err);
  }
});

// PATCH /api/admin/customers/:contactId/active
// Body: { "isActive": true | false }
router.patch('/customers/:contactId/active', async (req, res) => {
  try {
    const contactId = parsePositiveInt(req.params.contactId, 'contactId');
    const isActive = req.body?.isActive;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive (boolean) is required in body' });
    }
    const updated = await customerService.setActive(contactId, isActive);
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    return res.json(updated);
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
