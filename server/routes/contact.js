const express = require('express');
const { v4: uuid } = require('uuid');
const aspektClient = require('../middleware/aspektClient');
const contactMocks = require('../mocks/contact.mock');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const JSONStorage = require('../utils/jsonStorage');

const router = express.Router();

// Initialize JSON storage for users
const usersStorage = new JSONStorage('users.json');

// Get user data by alias/personalNumber
router.get('/user/:alias', async (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({ error: 'Alias parameter is required' });
  }

  try {
    const userData = usersStorage.get(alias);

    if (userData) {
      return res.json({
        success: true,
        data: userData
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error) {
    console.error('Get user error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
      details: error.message
    });
  }
});

router.get('/check', async (req, res) => {
  const { personalNumber } = req.query;



  if (!personalNumber) {
    return res.status(400).json({ error: 'Personal number is required' });
  }

  try {
    let response;

    if (process.env.USE_MOCK_API === 'true') {
      response = contactMocks.getContact(personalNumber);
    } else {
      const requestId = uuid();
      response = await aspektClient.get(`/api/getContact/${requestId}`, {
        data: { Alias: personalNumber }
      });
    }

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
router.post('/filter', async (req, res) => {
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
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for getContactByFilter
      response = {
        status: 200,
        data: {
          Id: 26834,
          Code: 200,
          Msg: "OK",
          Body: {
            ContactId: 338644,
            ContactCode: "5670930",
            FirstName: "SOMEONES",
            LastName: "TEST TEST",
            PersonalNumber: "18109954500176",
            Address: "30 Wellington Square",
            Mobile: "(996) 123-321456",
            BirthDate: "07.07.1977"
          }
        }
      };
    } else {
      console.log('=== GET CONTACT BY FILTER DEBUG ===');
      console.log('URL:', `/api/getContactByFilter/${requestId}`);
      console.log('Filters being sent:', JSON.stringify(Filters, null, 2));
      console.log('===================================');

      response = await aspektClient.get(`/api/getContactByFilter/${requestId}`, {
        data: { Filters: Filters }
      });
    }

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
  } = req.body;

  const uploadedFiles = [];

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
    let checkResponse;
    if (process.env.USE_MOCK_API === 'true') {
      checkResponse = contactMocks.getContact(personalNumber);
    } else {
      const requestId = uuid();
      checkResponse = await aspektClient.get(`/api/getContact/${requestId}`, {
        data: { Alias: personalNumber }
      });
    }

    // If user exists, return their stored information
    if (checkResponse.status === 200) {
      if (checkResponse.data?.Body && Array.isArray(checkResponse.data.Body) && checkResponse.data.Body.length > 0) {
        const contact = checkResponse.data.Body[0];
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

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      response = contactMocks.createSubscription(subscriptionData);

      // If using mock API and files were uploaded, link them to the user
      if (response.status === 200 && req.files) {
        const imageMapping = {
          selfie: 'selfie',
          idDocument: 'idDocument',
          utilityBill: 'utilityBill'
        };

        Object.keys(req.files).forEach(fieldName => {
          if (req.files[fieldName] && req.files[fieldName][0]) {
            const imagePath = req.files[fieldName][0].path;
            contactMocks.linkImageToUser(personalNumber, imageMapping[fieldName], imagePath);
          }
        });
      }
    } else {
      const requestId = uuid();
      response = await aspektClient.post(`/api/createSubscription/${requestId}`, subscriptionData);
    }

    // Handle Aspekt response codes
    if (response.status === 200) {
      return res.json({
        success: true,
        subscriptionId,
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
    // Clean up temporary files
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
});

// TODO 5: Subscription status polling endpoint
router.get('/subscription-status', async (req, res) => {
  const { subscriptionId } = req.query;

  if (!subscriptionId) {
    return res.status(400).json({ error: 'Subscription ID is required' });
  }

  try {
    let response;

    if (process.env.USE_MOCK_API === 'true') {
      response = contactMocks.checkSubscription(subscriptionId);
    } else {
      const requestId = uuid();
      response = await aspektClient.get(`/api/checkSubscription/${requestId}`, {
        data: { SubscriptionId: subscriptionId }
      });
    }

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
router.post('/test-create-contact', async (_req, res) => {
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

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      // For mocks, simulate createContact response
      response = {
        status: 200,
        data: {
          Id: 0,
          Code: 200,
          Msg: "OK: Contact created successfully!"
        }
      };
    } else {
      console.log(testData);
      response = await aspektClient.post(`/api/createContact/${requestId}`, testData);
    }

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
router.post('/test-create-subscription', async (_req, res) => {
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

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      response = contactMocks.createSubscription(testData);
    } else {
      console.log("TEST!");
      response = await aspektClient.post(`/api/createSubscription/${requestId}`, testData);
    }

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
router.get('/test-get-offices', async (req, res) => {
  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: [
            {
              OfficeId: 1,
              OfficeCode: "10",
              OfficeName: "PRIZREN Zyrja / PRIZREN Office ",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 2,
              OfficeCode: "11",
              OfficeName: "SUHAREKA Zyrja / SUHAREKA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 3,
              OfficeCode: "14",
              OfficeName: "XERXE Zyrja / XERXE Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 4,
              OfficeCode: "15",
              OfficeName: "MALISHEVA Zyrja / MALISHEVA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 5,
              OfficeCode: "16",
              OfficeName: "RAHOVEC Zyrja / RAHOVEC Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 6,
              OfficeCode: "17",
              OfficeName: "DRENAS Zyrja / DRENAS Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 7,
              OfficeCode: "18",
              OfficeName: "SKENDERAJ Zyrja / SKENDERAJ Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 8,
              OfficeCode: "19",
              OfficeName: "MITROVICA Zyrja / MITROVICA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 9,
              OfficeCode: "20",
              OfficeName: "GJAKOVA Zyrja / GJAKOVA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 10,
              OfficeCode: "21",
              OfficeName: "KLINA Zyrja / KLINA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 11,
              OfficeCode: "25",
              OfficeName: "PEJA Zyrja / PEJA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 12,
              OfficeCode: "26",
              OfficeName: "ISTOG Zyrja / ISTOG Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 13,
              OfficeCode: "27",
              OfficeName: "DECAN Zyrja / DECAN Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 14,
              OfficeCode: "30",
              OfficeName: "FERIZAJ Zyrja / FERIZAJ Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 15,
              OfficeCode: "32",
              OfficeName: "LIPJAN Zyrja / LIPJAN Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 16,
              OfficeCode: "33",
              OfficeName: "SHTIME Zyrja / SHTIME Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 17,
              OfficeCode: "34",
              OfficeName: "PRISHTINA2 Zyrja / PRISHTINA2 Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 18,
              OfficeCode: "35",
              OfficeName: "GJILAN Zyrja / GJILAN Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 19,
              OfficeCode: "36",
              OfficeName: "KAMENICA Zyrja / KAMENICA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 20,
              OfficeCode: "37",
              OfficeName: "VITIA-GJILAN Zyrja / VITIA-GJILAN Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 21,
              OfficeCode: "38",
              OfficeName: "GRACANICA Zyrja / GRACANICA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 22,
              OfficeCode: "39",
              OfficeName: "SHTRPCE Zyrja / SHTRPCE Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 23,
              OfficeCode: "40",
              OfficeName: "PRISHTINA Zyrja / PRISHTINA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 24,
              OfficeCode: "41",
              OfficeName: "PODUJEVA Zyrja / PODUJEVA Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 25,
              OfficeCode: "42",
              OfficeName: "FUSHE KOSOVE Zyrja / FUSHE KOSOVE Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 26,
              OfficeCode: "43",
              OfficeName: "VUSHTRI Zyrja / VUSHTRI Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 27,
              OfficeCode: "44",
              OfficeName: "KAQANIK Zyrja / KAQANIK Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 28,
              OfficeCode: "45",
              OfficeName: "OBILIQ Zyrja / OBILIQ Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 29,
              OfficeCode: "46",
              OfficeName: "PRIZREN2 Zyrja / PRIZREN2 Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 30,
              OfficeCode: "47",
              OfficeName: "PEJA2 Zyrja / PEJA2 Office",
              Place: {
                PlaceCode: "20000",
                PlaceName: "Prizren"
              }
            },
            {
              OfficeId: 32,
              OfficeCode: "01",
              OfficeName: "Head Office",
              Place: {
                PlaceCode: "10000",
                PlaceName: "Prishtina"
              }
            },
            {
              OfficeId: 33,
              OfficeCode: "12",
              OfficeName: "DRAGASH   Zyrja/   Dragash Office             ",
              Place: {
                PlaceCode: "-",
                PlaceName: "Migration"
              }
            },
            {
              OfficeId: 34,
              OfficeCode: "13",
              OfficeName: "RECAN  Zyrja /  Recan Office        ",
              Place: {
                PlaceCode: "-",
                PlaceName: "Migration"
              }
            },
            {
              OfficeId: 35,
              OfficeCode: "31",
              OfficeName: "VITI   Zyrja / Viti Office                      ",
              Place: {
                PlaceCode: "-",
                PlaceName: "Migration"
              }
            },
            {
              OfficeId: 36,
              OfficeCode: "02",
              OfficeName: "L&D",
              Place: {
                PlaceCode: "10000",
                PlaceName: "Prishtina"
              }
            },
            {
              OfficeId: 37,
              OfficeCode: "48",
              OfficeName: "MITROVICA NORTH Zyrja / MITROVICA NORTH Office",
              Place: {
                PlaceCode: "38220",
                PlaceName: "Mitrovice e Veriut"
              }
            },
            {
              OfficeId: 38,
              OfficeCode: "49",
              OfficeName: "Prishtina3 Zyrja / Prishtina3 Office",
              Place: {
                PlaceCode: "10000",
                PlaceName: "Prishtina"
              }
            },
            {
              OfficeId: 39,
              OfficeCode: "50",
              OfficeName: "Gjilan2 Zyrja / Gjilan2 Office",
              Place: {
                PlaceCode: "60000",
                PlaceName: "Gjilan"
              }
            }
          ]
        }
      };
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

// Test endpoint - Get all places
router.get('/test-get-places', async (req, res) => {
  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = {
        status: 200,
        data: {
          Id: 0,
          Code: 200,
          Msg: "OK",
          Body: [
            {
              PlaceCode: "0101001",
              PlaceName: "район Черемушка"
            },
            {
              PlaceCode: "0101002",
              PlaceName: "мкр. Западный"
            }
          ]
        }
      };
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

// Test endpoint - Get contact system IDs
router.get('/test-get-system-ids', async (req, res) => {
  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = {
        status: 200,
        data: {
          Code: 200,
          Msg: "OK",
          Body: {
            Educations: [
              {
                EducationId: 1,
                Education: "Student"
              },
              {
                EducationId: 2,
                Education: "Economist"
              }
            ],
            Nationalities: [
              {
                NationalityId: 1,
                Nationality: "Macedonian"
              },
              {
                NationalityId: 2,
                Nationality: "Albanian"
              }
            ],
            Citizenships: [
              {
                CitizenshipId: 1,
                Citizenship: "Malagasy"
              },
              {
                CitizenshipId: 2,
                Citizenship: "Français"
              }
            ],
            Occupations: [
              {
                OccupationId: 2,
                Occupation: "Accountant"
              },
              {
                OccupationId: 3,
                Occupation: "Architect"
              }
            ],
            Places: [
              {
                PlaceID: 1,
                Place: "AMBALAVAO ISOTRY"
              },
              {
                PlaceID: 2,
                Place: "ANTANIMALALAKA ANALAKELY"
              }
            ]
          }
        }
      };
    } else {
      response = await aspektClient.get(`/api/getContactSystemIds/${requestId}`, {
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
    console.error('Get contact system IDs error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch contact system IDs',
      details: error.message
    });
  }
});

// Test endpoint - Get officers by office code
router.get('/test-get-officers/:officeCode', async (req, res) => {
  const { officeCode } = req.params;

  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: [
            {
              OfficerId: 1,
              OfficerName: "The name of the officer",
              OfficerCode: "The code of the officer"
            }
          ]
        }
      };
    } else {
      response = await aspektClient.get(`/api/getOfficersByOfficeCode/${requestId}`, {
        data: { OfficeCode: officeCode }
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
    console.error('Get officers error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch officers',
      details: error.message
    });
  }
});

// Test endpoint - Update contact with predefined data
router.post('/test-update-contact', async (req, res) => {
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

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      response = {
        status: 200,
        data: {
          Id: 0,
          Code: 200,
          Msg: "OK: Contact updated successfully!"
        }
      };
    } else {
      response = await aspektClient.post(`/api/updateContact/${requestId}`, testData);
    }

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
router.post('/test-subscriptions-on-date', async (req, res) => {
  try {
    const testData = {
      Date: "06.11.2019"
    };

    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      response = {
        status: 200,
        data: {
          Id: 20633,
          Code: 200,
          Msg: "OK",
          Body: [
            {
              SubscriptionId: "CS.00000000000000121",
              StatusCode: 202,
              Status: "Pending"
            },
            {
              SubscriptionId: "SI.0305832556788",
              ContactCode: "7019664",
              StatusCode: 200,
              Status: "Approved",
              Note: "OK"
            }
          ]
        }
      };
    } else {
      response = await aspektClient.get(`/api/getAllSubscriptionsOnDate/${requestId}`, {
        data: testData
      });
    }

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

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { personalNumber, imageType } = req.body;

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    };

    // If using mock API and personalNumber/imageType are provided, link the image to the user
    if (process.env.USE_MOCK_API === 'true' && personalNumber && imageType) {
      const linked = contactMocks.linkImageToUser(personalNumber, imageType, req.file.path);
      if (linked) {
        return res.json({
          success: true,
          message: 'File uploaded and linked to user successfully',
          file: fileInfo,
          linkedToUser: personalNumber,
          imageType: imageType
        });
      } else {
        return res.json({
          success: true,
          message: 'File uploaded but user not found for linking',
          file: fileInfo,
          warning: `User with personal number ${personalNumber} not found`
        });
      }
    }

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

module.exports = router;