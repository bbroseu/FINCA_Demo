const express = require('express');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const aspektClient = require('../middleware/aspektClient');
const upload = require('../middleware/upload');
const requireJwt = require('../middleware/requireJwt');
const customerService = require('../services/customerService');
const fs = require('fs');
const path = require('path');

// Returns [{ type, path }, ...] from multer's req.files for persisting to user_images.
function collectUploadedImages(reqFiles) {
  if (!reqFiles) return [];
  const out = [];
  for (const [fieldName, files] of Object.entries(reqFiles)) {
    for (const f of files) {
      if (f?.path) out.push({ type: fieldName, path: f.path });
    }
  }
  return out;
}

const router = express.Router();

router.get('/check', async (req, res) => {
  const { personalNumber } = req.query;



  if (!personalNumber) {
    return res.status(400).json({ error: 'Personal number is required' });
  }

  try {
    const requestId = uuid();
    const response = await aspektClient.get(`/api/getContact/${requestId}`, {
      data: { Alias: personalNumber }
    });

    console.log(response.data.Body);

    if (response.status === 200) {
      if (response.data?.Body && Array.isArray(response.data.Body) && response.data.Body.length > 0) {
        const contact = response.data.Body[0];
        return res.json({
          exists: true,
          contact: {
            ContactCode: contact.ContactCode,
            firstName: contact.FirstName,
            lastName: contact.LastName,
            personalNumber: contact.PersonalNumber,
            birthDate: contact.BirthDate,
            address: contact.Address,
            mobile: contact.Mobile
          }
        });
      } else {
        return res.json({ exists: false });
      }
    } else if (response.status === 402) {
      return res.json({ exists: false });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Contact check error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get contact by filter
router.post('/filter', requireJwt, async (req, res) => {
  const { Filters } = req.body;

  if (!Filters || !Array.isArray(Filters) || Filters.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Filters array is required and must contain at least one filter',
      expectedFormat: {
        Filters: [
          { Type: "PERSONALNUMBER", Value: "112233" },
          { Type: "CODE", Value: "5671037" },
          { Type: "MOBILE", Value: "0285644" }
        ]
      }
    });
  }

  // Validate filter format
  for (const filter of Filters) {
    if (!filter.Type || !filter.Value) {
      return res.status(400).json({
        success: false,
        error: 'Each filter must have Type and Value properties',
        received: filter
      });
    }

    const validTypes = ['PERSONALNUMBER', 'CODE', 'MOBILE'];
    if (!validTypes.includes(filter.Type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid filter type. Must be one of: ${validTypes.join(', ')}`,
        received: filter.Type
      });
    }
  }

  try {
    const requestId = uuid();

    console.log('=== GET CONTACT BY FILTER DEBUG ===');
    console.log('URL:', `/api/getContactByFilter/${requestId}`);
    console.log('Filters being sent:', JSON.stringify(Filters, null, 2));
    console.log('===================================');

    const response = await aspektClient.get(`/api/getContactByFilter/${requestId}`, {
      data: { Filters: Filters }
    });

    // Check for API errors (both HTTP status and API response code)
    if (response.status !== 200 || response.data.Code !== 200) {
      const statusCode = response.data.Code === 402 ? 404 : // Person doesn't exist -> Not Found
                         response.data.Code === 404 ? 400 : // No filters in request -> Bad Request
                         400; // Other client errors

      return res.status(statusCode).json({
        success: false,
        error: response.data.Msg,
        code: response.data.Code
      });
    }

    // Return contact details
    const contact = response.data.Body;
    return res.json({
      success: true,
      contact: {
        contactId: contact.ContactId,
        contactCode: contact.ContactCode,
        firstName: contact.FirstName,
        lastName: contact.LastName,
        personalNumber: contact.PersonalNumber,
        address: contact.Address,
        mobile: contact.Mobile,
        birthDate: contact.BirthDate
      }
    });

  } catch (error) {
    console.error('Get contact by filter error:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);

    return res.status(500).json({
      success: false,
      error: 'Failed to get contact by filter',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

router.post('/register', upload.fields([
  { name: 'selfie', maxCount: 1 },
  { name: 'idDocument', maxCount: 1 },
  { name: 'utilityBill', maxCount: 1 }
]), async (req, res) => {
  const {
    firstName,
    lastName,
    personalNumber,
    birthDate,
    address,
    mobile,
    scanURLs,
    additionalInfo
  } = req.body || {};

  const uploadedFiles = [];
  let keepUploadedFiles = false;

  try {
    // Parse scanURLs and additionalInfo if they are JSON strings
    let parsedScanURLs = [];
    let parsedAdditionalInfo = [];

    if (scanURLs) {
      try {
        parsedScanURLs = typeof scanURLs === 'string' ? JSON.parse(scanURLs) : scanURLs;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid scanURLs format' });
      }
    }

    if (additionalInfo) {
      try {
        parsedAdditionalInfo = typeof additionalInfo === 'string' ? JSON.parse(additionalInfo) : additionalInfo;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid additionalInfo format' });
      }
    }

    // Validate required fields
    if (!firstName || !lastName || !personalNumber || !birthDate || !address || !mobile) {
      return res.status(400).json({ error: 'Missing required field' });
    }

    // Validate and normalize birth date format
    let normalizedBirthDate = birthDate;

    // Check for various formats and normalize to dd.mm.yyyy
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      // Convert yyyy-mm-dd to dd.mm.yyyy
      const parts = birthDate.split('-');
      normalizedBirthDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)) {
      // Convert dd/mm/yyyy to dd.mm.yyyy
      normalizedBirthDate = birthDate.replace(/\//g, '.');
    } else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(birthDate)) {
      return res.status(400).json({
        error: 'Invalid birth date format (use dd.mm.yyyy, dd/mm/yyyy, or yyyy-mm-dd)',
        received: birthDate
      });
    }

    // Validate the date is reasonable
    const [day, month, year] = normalizedBirthDate.split('.').map(Number);
    const date = new Date(year, month - 1, day);

    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      return res.status(400).json({
        error: 'Invalid birth date values',
        received: birthDate
      });
    }

    // Check if date is not in the future
    if (date > new Date()) {
      return res.status(400).json({
        error: 'Birth date cannot be in the future',
        received: birthDate
      });
    }

    // Validate mobile number format (digits only)
    if (!/^\d+$/.test(mobile)) {
      return res.status(400).json({ error: 'Invalid mobile number format' });
    }

    // Validate ScanURLs format if provided
    if (parsedScanURLs && parsedScanURLs.length > 0) {
      if (!Array.isArray(parsedScanURLs)) {
        return res.status(400).json({ error: 'ScanURLs must be an array' });
      }

      for (const scanUrl of parsedScanURLs) {
        if (!scanUrl.Name || !scanUrl.URL) {
          return res.status(400).json({ error: 'Each ScanURL must have Name and URL properties' });
        }
        if (typeof scanUrl.Name !== 'string' || typeof scanUrl.URL !== 'string') {
          return res.status(400).json({ error: 'ScanURL Name and URL must be strings' });
        }
      }
    }

    // Validate AdditionalInfo format if provided
    if (parsedAdditionalInfo && parsedAdditionalInfo.length > 0) {
      if (!Array.isArray(parsedAdditionalInfo)) {
        return res.status(400).json({ error: 'AdditionalInfo must be an array' });
      }

      for (const info of parsedAdditionalInfo) {
        if (!info.Key || info.Value === undefined) {
          return res.status(400).json({ error: 'Each AdditionalInfo must have Key and Value properties' });
        }
        if (typeof info.Key !== 'string') {
          return res.status(400).json({ error: 'AdditionalInfo Key must be a string' });
        }
      }
    }

    // Check if user already exists
    const checkRequestId = uuid();
    const checkResponse = await aspektClient.get(`/api/getContact/${checkRequestId}`, {
      data: { Alias: personalNumber }
    });

    // If user exists, mirror them into the local DB and return their stored info.
    if (checkResponse.status === 200) {
      if (checkResponse.data?.Body && Array.isArray(checkResponse.data.Body) && checkResponse.data.Body.length > 0) {
        const contact = checkResponse.data.Body[0];

        const saved = await customerService.createOrUpdateCustomer({
          contactCode: contact.ContactCode,
          personalNumber: contact.PersonalNumber,
          firstName: contact.FirstName,
          lastName: contact.LastName,
          birthDate: contact.BirthDate,
          mobile: contact.Mobile,
          address: contact.Address,
        });

        const images = collectUploadedImages(req.files);
        if (images.length > 0) {
          await customerService.attachUserImages(saved.contact_id, images);
          keepUploadedFiles = true;
        }

        return res.json({
          userExists: true,
          contact: {
            ContactCode: contact.ContactCode,
            firstName: contact.FirstName,
            lastName: contact.LastName,
            personalNumber: contact.PersonalNumber,
            birthDate: contact.BirthDate,
            address: contact.Address,
            mobile: contact.Mobile
          }
        });
      } else {
        // Status 200 but no valid contact data - treat as not found
        // Continue to create new subscription
      }
    }

    const subscriptionId = uuid();

    // Create subscription first
    const subscriptionData = {
      SubscriptionId: subscriptionId,
      FirstName: firstName,
      LastName: lastName,
      PersonalNumber: personalNumber,
      Address: address,
      Mobile: mobile,
      BirthDate: normalizedBirthDate,
      ...(parsedScanURLs.length > 0 && { ScanURLs: parsedScanURLs }),
      ...(parsedAdditionalInfo.length > 0 && { AdditionalInfo: parsedAdditionalInfo })
    };

    const requestId = uuid();
    const response = await aspektClient.post(`/api/createSubscription/${requestId}`, subscriptionData);

    // Handle Aspekt response codes
    if (response.status === 200) {
      // CBS accepted the subscription (still pending approval over there).
      // Persist the registration locally so we have a record before approval.
      const saved = await customerService.createOrUpdateCustomer({
        personalNumber,
        firstName,
        lastName,
        birthDate: normalizedBirthDate,
        mobile,
        address,
      });

      const images = collectUploadedImages(req.files);
      if (images.length > 0) {
        await customerService.attachUserImages(saved.contact_id, images);
        keepUploadedFiles = true;
      }

      return res.json({
        success: true,
        subscriptionId,
        contactId: saved.contact_id,
        contactCode: saved.contact_code,
        status: "pending"
      });
    } else if (response.data?.Code === 441) {
      return res.status(409).json({ error: 'Duplicate SubscriptionId' });
    } else if (response.data?.Code === 442) {
      return res.status(409).json({ error: 'Personal number already registered' });
    } else if (response.data?.Code === 405) {
      return res.status(409).json({ error: 'Person already exists — use login flow' });
    } else if (response.data?.Code === 491) {
      return res.status(400).json({ error: 'Invalid birth date format (use dd.mm.yyyy)' });
    } else if (response.data?.Code === 494) {
      return res.status(400).json({ error: 'Invalid mobile number format' });
    } else if (response.data?.Code === 404) {
      return res.status(400).json({ error: 'Missing required field' });
    } else {
      throw new Error('Unexpected response from CBS');
    }

  } catch (error) {
    console.error('Contact registration error:', error.message);
    return res.status(500).json({ error: 'Registration failed' });
  } finally {
    // Clean up temporary files — but keep them when they've been linked into
    // user_images, otherwise the DB row would point at a missing path.
    if (!keepUploadedFiles) {
      if (req.files) {
        Object.values(req.files).flat().forEach(file => {
          uploadedFiles.push(file.path);
        });
      }

      uploadedFiles.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up file:', filePath, cleanupError.message);
        }
      });
    }
  }
});

// TODO 5: Subscription status polling endpoint
router.get('/subscription-status', requireJwt, async (req, res) => {
  const { subscriptionId } = req.query;

  if (!subscriptionId) {
    return res.status(400).json({ error: 'Subscription ID is required' });
  }

  try {
    const requestId = uuid();
    const response = await aspektClient.get(`/api/checkSubscription/${requestId}`, {
      data: { SubscriptionId: subscriptionId }
    });

    if (response.data?.Code === 440) {
      return res.status(404).json({ error: 'SubscriptionId not found' });
    }

    const status = response.data?.Body?.Status;

    if (status === "Approved") {
      return res.json({
        status: "approved",
        contactCode: response.data.Body.ContactCode
      });
    } else if (status === "Pending") {
      return res.json({ status: "pending" });
    } else if (status === "Rejected") {
      return res.json({
        status: "rejected",
        reason: response.data.Body.Note || "Registration rejected"
      });
    } else {
      throw new Error('Unexpected status from CBS');
    }

  } catch (error) {
    console.error('Subscription status check error:', error.message);
    return res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// Test endpoint for createContact API
router.post('/test-create-contact', requireJwt, async (_req, res) => {
  try {
    const testData = {
      "FirstName": "Emily",
      "LastName": "Robertson",
      "PersonalNumber": "123424234",
      "Address": "street 54/2 city",
      "Mobile": "00389787778888",
      "BirthDate": "01.01.1990"
    };

    const requestId = uuid(); // Random requestId

    // Log what we're sending to debug the issue
    console.log('=== CREATE CONTACT DEBUG ===');
    console.log('URL:', `/api/createContact/${requestId}`);
    console.log('Data being sent:', JSON.stringify(testData, null, 2));
    console.log('BirthDate format check:', /^\d{2}\.\d{2}\.\d{4}$/.test(testData.BirthDate));
    console.log('===========================');

    console.log(testData);
    const response = await aspektClient.post(`/api/createContact/${requestId}`, testData);

    return res.json({
      success: true,
      requestId: requestId,
      testData: testData,
      response: response.data,
      status: response.status
    });

  } catch (error) {
    console.error('Test create contact error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create test contact',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Test endpoint for createSubscription API
router.post('/test-create-subscription', requireJwt, async (_req, res) => {
  try {
    const testData = {
      "SubscriptionId": "99887766554433",
      "FirstName": "Emily",
      "LastName": "Robertson",
      "PersonalNumber": "12345678",
      "Address": " street 54/2 city",
      "Mobile": "00389787778888",
      "BirthDate": "30.05.2010",
      "ScanURLs": [
        {
          "Name": "ContactPicture",
          "URL": "https://xxxxxxx/picture1.jpg"
        },
        {
          "Name": "PassportScanURL",
          "URL": "https://xxxxxxx/picture2.jpg"
        },
        {
          "Name": "PassportScanURL",
          "URL": "https://xxxxxxx/picture3.jpg"
        }
      ],
      "AdditionalInfo": [
        {
          "Key": "ContactGender",
          "Value": "Male"
        },
        {
          "Key": "ContactSalary",
          "Value": 1000
        }
      ]
    };

    const requestId = Math.floor(Math.random() * 10000).toString();

    console.log("TEST!");
    const response = await aspektClient.post(`/api/createSubscription/${requestId}`, testData);

    return res.json({
      success: true,
      requestId: requestId,
      testData: testData,
      response: response.data,
      status: response.status
    });

  } catch (error) {
    console.error('Test create subscription error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to create test subscription',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Test endpoint - Get all offices
router.get('/test-get-offices', requireJwt, async (req, res) => {
  try {
    const requestId = uuid();

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


// Test endpoint - Get all places
router.get('/test-get-places', requireJwt, async (req, res) => {
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

// Test endpoint - Get contact system IDs
router.get('/test-get-system-ids', requireJwt, async (req, res) => {
  try {
    const requestId = uuid();

    const response = await aspektClient.get(`/api/getContactSystemIds/${requestId}`, {
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
    console.error('Get contact system IDs error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch contact system IDs',
      details: error.message
    });
  }
});

// Test endpoint - Get officers by office code
router.get('/test-get-officers/:officeCode', requireJwt, async (req, res) => {
  const { officeCode } = req.params;

  try {
    const requestId = uuid();

    const response = await aspektClient.get(`/api/getOfficersByOfficeCode/${requestId}`, {
      data: { OfficeCode: officeCode }
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
    console.error('Get officers error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch officers',
      details: error.message
    });
  }
});

// Test endpoint - Update contact with predefined data
router.post('/test-update-contact', requireJwt, async (req, res) => {
  try {
    const testData = {
      Alias: "USR000000345",
      FirstName: "Emily",
      LastName: "Robertson",
      Address: " street 54/2 city",
      Mobile: "00389787778888",
      BirthDate: "30.05.2010"
    };

    const requestId = uuid();

    console.log('=== TEST UPDATE CONTACT ===');
    console.log('URL:', `${process.env.API_BASE_URL}/api/updateContact/${requestId}`);
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('===========================');

    const response = await aspektClient.post(`/api/updateContact/${requestId}`, testData);

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status
    });

  } catch (error) {
    console.error('Test update contact error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to update test contact',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Test endpoint - Get all subscriptions on date
router.post('/test-subscriptions-on-date', requireJwt, async (req, res) => {
  try {
    const testData = {
      Date: "06.11.2019"
    };

    const requestId = uuid();

    const response = await aspektClient.get(`/api/getAllSubscriptionsOnDate/${requestId}`, {
      data: testData
    });

    return res.json({
      success: true,
      requestId: requestId,
      testData: testData,
      response: response.data,
      status: response.status
    });

  } catch (error) {
    console.error('Test get subscriptions on date error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to get subscriptions on date',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

router.post('/upload', requireJwt, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { personalNumber, imageType } = req.body || {};

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    };

    return res.json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo
    });

  } catch (error) {
    console.error('File upload error:', error.message);
    return res.status(500).json({ error: 'File upload failed' });
  } finally {
    // Optional: Clean up file after processing if needed
    // This would depend on your use case
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  if (err && err.statusCode === 400) return res.status(400).json({ error: err.message });
  return next(err);
});

module.exports = router;