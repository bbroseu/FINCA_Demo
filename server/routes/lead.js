const express = require('express');
const { v4: uuid } = require('uuid');
const aspektClient = require('../middleware/aspektClient');
const leadService = require('../services/leadService');
const leadStoreService = require('../services/leadStoreService');
const requireJwt = require('../middleware/requireJwt');
const requireAnyJwt = require('../middleware/requireAnyJwt');
const requireAdmin = require('../middleware/requireAdmin');

function isAdmin(req) {
  return req.user?.role === 'admin';
}

// True if the caller created (or, for admins, may inspect) the given lead row.
function callerOwnsLead(req, lead) {
  if (req.actor?.type === 'staff') {
    if (req.user.role === 'admin') return true;
    return lead.created_by_auth_user_id === req.user.id;
  }
  if (req.actor?.type === 'customer') {
    return lead.created_by_contact_id === req.customer.contact_id;
  }
  return false;
}

// For :alias routes: when the caller is a customer, force the alias path-param
// to match their own personal_number so they can't query another customer's data.
function ensureAliasOwnership(req, res, next) {
  if (req.actor?.type === 'customer') {
    if (req.params.alias !== req.customer.personal_number) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  next();
}

const upload = require('../middleware/upload');

const router = express.Router();

// Step 3.1 - Get available loan products
router.get('/products/:alias', requireAnyJwt, ensureAliasOwnership, async (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    const requestId = uuid();

    const response = await aspektClient.get(`/api/getProducts/${requestId}`, {
      data: { Alias: alias }
    });

    if (response.status === 200) {
      return res.json({
        success: true,
        data: response.data.Body.Products
      });
    } else if (response.status === 402) {
      return res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Get products error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch products',
      details: error.message
    });
  }
});

// Step 3.1 - Get products with detailed levels
router.get('/products-with-levels/:alias', requireAnyJwt, ensureAliasOwnership, async (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    const requestId = uuid();

    const response = await aspektClient.get(`/api/getProductsWithLevels/${requestId}`, {
      data: { Alias: alias }
    });

    console.log('=== /products-with-levels response ===');
    console.log('alias:', alias);
    console.log('status:', response.status);
    console.log('aspekt code:', response.data?.Code, response.data?.Msg);
    console.log('body:', JSON.stringify(response.data?.Body, null, 2));
    console.log('======================================');

    if (response.status === 200) {
      return res.json({
        success: true,
        data: response.data.Body.Products
      });
    } else if (response.status === 402) {
      return res.status(404).json({
        success: false,
        error: 'Person not found'
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Get products with levels error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch products with levels',
      details: error.message
    });
  }
});

// Step 3.2 - Get loan purposes for product
router.get('/loan-purposes/:product', requireAnyJwt, async (req, res) => {
  const { product } = req.params;

  if (!product) {
    return res.status(400).json({ error: 'Product parameter is required' });
  }

  try {
    const requestId = uuid();

    const response = await aspektClient.get(`/api/getLoanPurposes/${requestId}`, {
      data: { Product: product }
    });

    if (response.status === 200) {
      return res.json({
        success: true,
        data: response.data.Body
      });
    } else if (response.data.Code === 504) {
      return res.status(404).json({
        success: false,
        error: 'LoanPurpose not found for this product'
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Get loan purposes error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch loan purposes',
      details: error.message
    });
  }
});

// Step 3.2 - Get business types for product
router.get('/business-types/:product', requireAnyJwt, async (req, res) => {
  const { product } = req.params;

  if (!product) {
    return res.status(400).json({ error: 'Product parameter is required' });
  }

  try {
    const requestId = uuid();

    const response = await aspektClient.get(`/api/getBusinessTypes/${requestId}`, {
      data: { Product: product }
    });

    if (response.status === 200) {
      return res.json({
        success: true,
        data: response.data.Body
      });
    } else if (response.data.Code === 503) {
      return res.status(404).json({
        success: false,
        error: 'BusinessType not found for this product'
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Get business types error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch business types',
      details: error.message
    });
  }
});

router.get('/offices', requireAnyJwt, async (req, res) => {
  try {
    const requestId = uuid();
    console.log(requestId);

    const response = await aspektClient.get(`/api/getAllOffices/${requestId}`, {
      data: {}
    });

    if (response.status === 200) {
      return res.json({
        success: true,
        data: response.data.Body
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Get offices error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch offices',
      details: error.message
    });
  }
});

// Step 3.3 - Get all places
router.get('/places', requireAnyJwt, async (req, res) => {
  try {
    const requestId = uuid();

    const response = await aspektClient.get(`/api/getAllPlaces/${requestId}`, {
      data: {}
    });

    if (response.status === 200) {
      return res.json({
        success: true,
        data: response.data.Body
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Get places error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch places',
      details: error.message
    });
  }
});

// Step 3.4 - Get all lead sources
router.get('/sources', requireAnyJwt, async (req, res) => {
  try {
    const requestId = uuid();

    const response = await aspektClient.get(`/api/getAllLeadSources/${requestId}`, {
      data: {}
    });

    if (response.status === 200) {
      return res.json({
        success: true,
        data: response.data.Body
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Get lead sources error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch lead sources',
      details: error.message
    });
  }
});

// Utility endpoint - Get mobile app lead source code
router.get('/mobile-lead-source', requireAnyJwt, async (req, res) => {
  try {
    const mobileSourceCode = await leadService.getMobileAppLeadSourceCode();

    if (mobileSourceCode) {
      return res.json({
        success: true,
        data: { leadSourceCode: mobileSourceCode }
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Mobile app lead source not found'
      });
    }

  } catch (error) {
    console.error('Get mobile lead source error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch mobile lead source',
      details: error.message
    });
  }
});

// Check lead status endpoint
router.post('/check-status', requireJwt, async (req, res) => {
  //            "LeadNumber": "117956/26",
  //            "LeadId": 1077819
  const { LeadNumber } = req.body;

  if (!LeadNumber) {
    return res.status(400).json({
      success: false,
      error: 'LeadNumber is required'
    });
  }

  try {
    const requestId = uuid();

    const response = await aspektClient.post(`/api/checkLeadStatus/${requestId}`, {
      LeadNumber: LeadNumber
    });

    if (response.status === 200 && response.data.Code === 200) {
      return res.json({
        success: true,
        data: response.data.Body
      });
    } else if (response.data.Code === 404) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Check lead status error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check lead status',
      details: error.message
    });
  }
});

// Step 3.7 - Create lead endpoint
router.post('/create', requireAnyJwt, async (req, res) => {
  try {
    // Validate required fields
    const validation = leadService.validateLeadData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const requestId = uuid();

    const response = await aspektClient.post(`/api/createLead/${requestId}`, req.body);

    if (response.status === 200 && response.data.Code === 200) {
      // Persist a local copy so the dashboard list/get endpoints have data
      // to return. Aspekt remains the source of truth; persistence is
      // best-effort and never blocks the success response.
      try {
        await leadStoreService.persistLead({
          requestBody: req.body,
          aspektBody: response.data.Body,
          createdByAuthUserId: req.actor?.type === 'staff' ? req.user.id : null,
          createdByContactId: req.actor?.type === 'customer' ? req.customer.contact_id : null,
        });
      } catch (persistErr) {
        console.error('Local lead persistence failed:', persistErr.message);
      }

      return res.json({
        success: true,
        data: {
          leadNumber: response.data.Body.LeadNumber,
          leadId: response.data.Body.LeadId,
          message: 'Lead created successfully'
        }
      });
    } else if (response.data.Code === 401) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate request ID'
      });
    } else if (response.data.Code === 402) {
      return res.status(404).json({
        success: false,
        error: 'Person does not exist'
      });
    } else if (response.data.Code === 404) {
      return res.status(400).json({
        success: false,
        error: 'Missing required data'
      });
    } else if (response.data.Code === 501) {
      return res.status(400).json({
        success: false,
        error: 'Lead source code not found'
      });
    } else if (response.data.Code === 900) {
      return res.status(500).json({
        success: false,
        error: 'General error occurred'
      });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Create lead error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create lead',
      details: error.message
    });
  }
});

// Get all leads — ADMIN ONLY. Non-admins should use GET /mine.
// Query params: ?status=&search=&limit=&offset=
router.get('/all', requireJwt, requireAdmin, async (req, res) => {
  try {
    const result = await leadStoreService.listLeads({
      status: req.query.status,
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get all leads error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch leads', details: error.message });
  }
});

// Leads created by the authenticated caller.
// Staff sees leads they created (created_by_auth_user_id).
// Customers see leads they created (created_by_contact_id).
// Query params: ?status=&search=&limit=&offset=
router.get('/mine', requireAnyJwt, async (req, res) => {
  try {
    const filter = req.actor?.type === 'customer'
      ? { createdByContactId: req.customer.contact_id }
      : { createdByAuthUserId: req.user.id };

    const result = await leadStoreService.listLeads({
      ...filter,
      status: req.query.status,
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Get my leads error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch leads', details: error.message });
  }
});

// Get leads by personalNumber/alias — ADMIN ONLY.
router.get('/by-user/:alias', requireJwt, requireAdmin, async (req, res) => {
  const { alias } = req.params;
  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    const leads = await leadStoreService.listLeadsByPersonalNumber(alias);
    return res.json({ success: true, items: leads });
  } catch (error) {
    console.error('Get leads by user error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch user leads', details: error.message });
  }
});

// User profile (Aspekt getContact) + local leads for that user.
router.get('/user-profile/:alias', requireJwt, async (req, res) => {
  const { alias } = req.params;
  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    const requestId = uuid();
    let contact = null;
    let contactError = null;

    try {
      const response = await aspektClient.get(`/api/getContact/${requestId}`, {
        data: { Alias: alias }
      });
      if (response.status === 200 && Array.isArray(response.data?.Body) && response.data.Body.length > 0) {
        contact = response.data.Body[0];
      } else if (response.data?.Code === 402) {
        contactError = 'Person does not exist';
      } else {
        contactError = response.data?.Msg || 'Unable to fetch contact';
      }
    } catch (err) {
      console.error('user-profile: getContact failed:', err.message);
      contactError = 'Aspekt API unavailable';
    }

    const leads = await leadStoreService.listLeadsByPersonalNumber(alias);

    return res.json({
      success: true,
      alias,
      contact,
      contactError,
      leads,
    });
  } catch (error) {
    console.error('Get user profile error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
  }
});

// Update local lead status. Note: Aspekt does not accept status updates from
// merchants — the bank pushes status via notifications. This endpoint updates
// only the merchant-side view.
router.patch('/:leadId/status', requireAnyJwt, async (req, res) => {
  const { leadId } = req.params;
  const { status } = req.body || {};

  if (!leadId || !status) {
    return res.status(400).json({ error: 'Lead ID and status are required' });
  }

  try {
    const existing = await leadStoreService.getLeadById(leadId);
    if (!existing) return res.status(404).json({ success: false, error: 'Lead not found' });
    if (!callerOwnsLead(req, existing)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updated = await leadStoreService.updateLeadStatus(leadId, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error('Update lead status error:', error.message);
    return res.status(500).json({ error: 'Failed to update lead status', details: error.message });
  }
});

// Health check endpoint
router.get('/', requireJwt, (_req, res) => {
  res.json({
    message: 'Lead API - Flow 3 (Loan Application) endpoints available',
    endpoints: {
      'GET /products/:alias': 'Get available loan products for user',
      'GET /products-with-levels/:alias': 'Get products with detailed level tiers for user',
      'GET /loan-purposes/:product': 'Get loan purposes for specific product',
      'GET /business-types/:product': 'Get business types for specific product',
      'GET /offices': 'Get all offices/branches',
      'GET /places': 'Get all places',
      'GET /sources': 'Get all lead sources',
      'GET /mobile-lead-source': 'Get mobile app lead source code',
      'POST /create': 'Create new lead application',
      'GET /all': 'Admin-only — list all leads (filters: status, search, limit, offset)',
      'GET /mine': "List leads created by the authenticated user (filters: status, search, limit, offset)",
      'GET /by-user/:alias': 'Admin-only — leads for a personalNumber from local DB',
      'GET /user-profile/:alias': 'Aspekt getContact + local leads for the user',
      'GET /:leadId': 'Get a lead (own lead for non-admins); refreshed with Aspekt checkLeadStatus',
      'PATCH /:leadId/status': 'Update local lead status (own lead for non-admins)'
    }
  });
});

// Get lead by lead_id (numeric) or lead_number (e.g. "000250/21").
// Reads the local row and, when a lead_number is known, enriches with
// Aspekt's live status from POST /api/checkLeadStatus.
router.get('/:leadId', requireAnyJwt, async (req, res) => {
  const { leadId } = req.params;
  if (!leadId) {
    return res.status(400).json({ error: 'Lead ID parameter is required' });
  }

  try {
    const lead = await leadStoreService.getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    if (!callerOwnsLead(req, lead)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    let aspektStatus = null;
    let aspektError = null;
    try {
      const requestId = uuid();
      const response = await aspektClient.post(`/api/checkLeadStatus/${requestId}`, {
        LeadNumber: lead.lead_number,
      });
      if (response.status === 200 && response.data?.Code === 200 && response.data?.Body) {
        aspektStatus = {
          leadNumber: response.data.Body.LeadNumber,
          name: response.data.Body.Name,
          status: response.data.Body.Status,
          statusCode: response.data.Body.StatusCode,
          note: response.data.Body.Note,
        };
      } else if (response.data?.Code === 502) {
        aspektError = 'LeadNumber not found in Aspekt';
      } else {
        aspektError = response.data?.Msg || 'Unable to fetch lead status';
      }
    } catch (err) {
      console.error('checkLeadStatus failed:', err.message);
      aspektError = 'Aspekt API unavailable';
    }

    return res.json({
      success: true,
      data: {
        ...lead,
        aspekt: aspektStatus,
        aspektError,
      },
    });
  } catch (error) {
    console.error('Get lead by ID error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch lead', details: error.message });
  }
});

module.exports = router;
