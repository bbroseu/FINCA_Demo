const express = require('express');
const { v4: uuid } = require('uuid');
const aspektClient = require('../middleware/aspektClient');
const leadService = require('../services/leadService');
const leadMocks = require('../mocks/lead.mock');
const upload = require('../middleware/upload');

const router = express.Router();

// Step 3.1 - Get available loan products
router.get('/products/:alias', async (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.getProducts(alias);
    } else {
      response = await aspektClient.get(`/api/getProducts/${requestId}`, {
        data: { Alias: alias }
      });
    }

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
    } else if (response.data.Code === 450) {
      // User has no products, return default products
      const defaultProducts = require('../mocks/product.mock');
      const defaultResponse = defaultProducts.getProducts(alias);
      return res.json({
        success: true,
        data: defaultResponse.data.Body.Products
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
router.get('/products-with-levels/:alias', async (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.getProductsWithLevels(alias);
    } else {
      response = await aspektClient.get(`/api/getProductsWithLevels/${requestId}`, {
        data: { Alias: alias }
      });
    }

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
    } else if (response.data.Code === 450) {
      // User has no products, return default products with levels
      const defaultProducts = require('../mocks/product.mock');
      const defaultResponse = defaultProducts.getProductsWithLevels();
      return res.json({
        success: true,
        data: defaultResponse.data.Body.Products
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
router.get('/loan-purposes/:product', async (req, res) => {
  const { product } = req.params;

  if (!product) {
    return res.status(400).json({ error: 'Product parameter is required' });
  }

  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.getLoanPurposes(product);
    } else {
      response = await aspektClient.get(`/api/getLoanPurposes/${requestId}`, {
        data: { Product: product }
      });
    }

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
router.get('/business-types/:product', async (req, res) => {
  const { product } = req.params;

  if (!product) {
    return res.status(400).json({ error: 'Product parameter is required' });
  }

  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.getBusinessTypes(product);
    } else {
      response = await aspektClient.get(`/api/getBusinessTypes/${requestId}`, {
        data: { Product: product }
      });
    }

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

router.get('/offices', async (req, res) => {
  try {
    let response;
    const requestId = uuid();
    console.log(requestId);

    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.getAllOffices();
    } else {
      response = await aspektClient.get(`/api/getAllOffices/${requestId}`, {
        data: {}
      });
    }

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
router.get('/places', async (req, res) => {
  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.getAllPlaces();
    } else {
      response = await aspektClient.get(`/api/getAllPlaces/${requestId}`, {
        data: {}
      });
    }

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
router.get('/sources', async (req, res) => {
  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.getAllLeadSources();
    } else {
      response = await aspektClient.get(`/api/getAllLeadSources/${requestId}`, {
        data: {}
      });
    }

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
router.get('/mobile-lead-source', async (req, res) => {
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
router.post('/check-status', async (req, res) => {
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
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for lead status check
      response = {
        status: 200,
        data: {
          Id: 43903,
          Code: 200,
          Msg: "OK",
          Body: {
            LeadNumber: LeadNumber,
            Name: "ASPEKT TEST LEAD",
            Status: "New",
            StatusCode: "201",
            Note: "This is a note"
          }
        }
      };
    } else {
      response = await aspektClient.post(`/api/checkLeadStatus/${requestId}`, {
        LeadNumber: LeadNumber
      });
    }

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
router.post('/create', async (req, res) => {
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

    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.createLead(req.body);
    } else {
      response = await aspektClient.post(`/api/createLead/${requestId}`, req.body);
    }

    if (response.status === 200 && response.data.Code === 200) {
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

// Debug endpoint to check what's being sent
router.post('/debug-request', async (_req, res) => {
  try {
    const testData = {
      "Name": "Metidacon Iniesta",
      "PlaceCode": "38220",
      "Mobile": "00383 7223-138",
      "Email": "te0o3190@test.com",
      "LeadSourceCode": "01",
      "LeadCategoryCode": "001",
      "Note": "Ky eshte nje test",
      "LoanAmount": 10000,
      "Priority": "Normal"
    };

    const requestId = Math.floor(Math.random() * 10000).toString();

    // Log what we're about to send
    console.log('=== DEBUG REQUEST ===');
    console.log('URL:', `${process.env.API_BASE_URL}/api/createLead/${requestId}`);
    console.log('Headers:', {
      'Content-Type': 'application/json',
      'Username': process.env.MERCHANT_USERNAME,
      'ApiKey': process.env.MERCHANT_API_KEY,
    });
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('====================');

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.createLead(testData);
    } else {
      response = await aspektClient.post(`/api/createLead/${requestId}`, testData);
    }

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status,
      debug: {
        url: `${process.env.API_BASE_URL}/api/createLead/${requestId}`,
        headers: aspektClient.defaults.headers,
        env: {
          username: process.env.MERCHANT_USERNAME,
          apiKey: process.env.MERCHANT_API_KEY ? '***HIDDEN***' : 'MISSING'
        }
      }
    });

  } catch (error) {
    console.error('Debug request error:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);

    return res.status(500).json({
      success: false,
      error: 'Failed to create debug request',
      details: error.message,
      fullError: error.response?.data || error.message,
      debugInfo: {
        status: error.response?.status,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      }
    });
  }
});

// Test endpoint with your specific data
router.post('/test-create', async (_req, res) => {
  try {
    const testData = {
      "Name": "Metidacon Iniesta",
      "PlaceCode": "38220",
      "Mobile": "00383 7223-138",
      "Email": "te0o3190@test.com",
      "LeadSourceCode": "01",
      "LeadCategoryCode": "001",
      "Note": "Ky eshte nje test",
      "LoanAmount": 10000,
      "Priority": "Normal",
      "InterestedInProducts": [
        {
          "ProductCode": "9090909 - Start up kredi biznesi per gra / Start up women business loan"
        },
        {
          "ProductCode": "1014 - Start up kredi biznesi per gra / Start up women business loan"
        }
      ],
      "LeadDdc": [
        {
          "Key": "UniqueId_20220901093211360",
          "Value": "1123012527"
        },
        {
          "Key": "lead_municipality",
          "Value": "Mitrovice e Veriut"
        },
        {
          "Key": "lead_marketing_campaigns",
          "Value": "Yes"
        },
        {
          "Key": "lead_branch_promotions",
          "Value": "Yes"
        },
        {
          "Key": "lead_sms_promotions",
          "Value": "Yes"
        },
        {
          "Key": "lead_telesales",
          "Value": "Yes"
        },
        {
          "Key": "lead_MarketingCommunication",
          "Value": "Yes"
        }
      ]
    };

    const requestId = Math.floor(Math.random() * 10000).toString(); // Random number like 898

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      response = leadMocks.createLead(testData);
    } else {
      response = await aspektClient.post(`/api/createLead/${requestId}`, testData);
    }

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status
    });

  } catch (error) {
    console.error('Test create lead error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create test lead',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Get all leads (mock only)
router.get('/all', (req, res) => {
  try {
    if (process.env.USE_MOCK_API === 'true') {
      const allLeads = leadMocks.getAllLeads();
      return res.json({
        success: true,
        data: allLeads
      });
    } else {
      return res.status(501).json({
        success: false,
        error: 'This endpoint is only available in mock mode'
      });
    }
  } catch (error) {
    console.error('Get all leads error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch leads',
      details: error.message
    });
  }
});

// Get leads by personalNumber/alias (mock only)
router.get('/by-user/:alias', (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    if (process.env.USE_MOCK_API === 'true') {
      const userLeads = leadMocks.getLeadsByPersonalNumber(alias);
      return res.json({
        success: true,
        data: userLeads,
        count: userLeads.length
      });
    } else {
      return res.status(501).json({
        success: false,
        error: 'This endpoint is only available in mock mode'
      });
    }
  } catch (error) {
    console.error('Get leads by user error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch user leads',
      details: error.message
    });
  }
});

// Get user with all their leads (mock only)
router.get('/user-profile/:alias', (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    if (process.env.USE_MOCK_API === 'true') {
      const userWithLeads = leadMocks.getUserWithLeads(alias);
      if (userWithLeads) {
        return res.json({
          success: true,
          data: userWithLeads
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
    } else {
      return res.status(501).json({
        success: false,
        error: 'This endpoint is only available in mock mode'
      });
    }
  } catch (error) {
    console.error('Get user profile error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch user profile',
      details: error.message
    });
  }
});

// Update lead status (mock only)
router.patch('/:leadId/status', (req, res) => {
  const { leadId } = req.params;
  const { status } = req.body;

  if (!leadId || !status) {
    return res.status(400).json({ error: 'Lead ID and status are required' });
  }

  try {
    if (process.env.USE_MOCK_API === 'true') {
      const updated = leadMocks.updateLeadStatus(leadId, status);
      if (updated) {
        return res.json({
          success: true,
          message: 'Lead status updated successfully'
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'Lead not found'
        });
      }
    } else {
      return res.status(501).json({
        success: false,
        error: 'This endpoint is only available in mock mode'
      });
    }
  } catch (error) {
    console.error('Update lead status error:', error.message);
    return res.status(500).json({
      error: 'Failed to update lead status',
      details: error.message
    });
  }
});

// Health check endpoint
router.get('/', (_req, res) => {
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
      'GET /all': 'Get all leads (mock only)',
      'GET /by-user/:alias': 'Get leads by user personalNumber/alias (mock only)',
      'GET /user-profile/:alias': 'Get user with all their leads (mock only)',
      'GET /:leadId': 'Get lead by ID (mock only)',
      'PATCH /:leadId/status': 'Update lead status (mock only)'
    }
  });
});

// Get lead by ID (mock only) - must be last to avoid conflicts
router.get('/:leadId', (req, res) => {
  const { leadId } = req.params;

  if (!leadId) {
    return res.status(400).json({ error: 'Lead ID parameter is required' });
  }

  try {
    if (process.env.USE_MOCK_API === 'true') {
      const lead = leadMocks.getLeadById(leadId);
      if (lead) {
        return res.json({
          success: true,
          data: lead
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'Lead not found'
        });
      }
    } else {
      return res.status(501).json({
        success: false,
        error: 'This endpoint is only available in mock mode'
      });
    }
  } catch (error) {
    console.error('Get lead by ID error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch lead',
      details: error.message
    });
  }
});

module.exports = router;

