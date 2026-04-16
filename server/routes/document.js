const express = require('express');
const { v4: uuid } = require('uuid');
const aspektClient = require('../middleware/aspektClient');
const documentMocks = require('../mocks/document.mock');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// TODO 3: Document upload endpoint
router.post('/upload', upload.fields([
  { name: 'selfie', maxCount: 1 },
  { name: 'idDocument', maxCount: 1 }
]), async (req, res) => {
  const { contactCode } = req.body;
  const uploadedFiles = [];

  if (!contactCode) {
    return res.status(400).json({ error: 'Contact code is required' });
  }

  if (!req.files || (!req.files.selfie && !req.files.idDocument)) {
    return res.status(400).json({ error: 'At least one file (selfie or idDocument) is required' });
  }

  try {
    const documentIds = [];

    // Process selfie
    if (req.files.selfie) {
      const selfieFile = req.files.selfie[0];
      uploadedFiles.push(selfieFile.path);

      const base64Data = fs.readFileSync(selfieFile.path).toString('base64');

      const documentData = {
        Source: "Person",
        SourceKey: contactCode,
        DocumentDefinitionCode: "ContactPicture",
        Description: "Uploaded from mobile app",
        File: {
          Name: selfieFile.originalname,
          Base64: base64Data
        }
      };

      let response;
      if (process.env.USE_MOCK_API === 'true') {
        response = documentMocks.createDocument();
      } else {
        const requestId = uuid();
        response = await aspektClient.post(`/api/createDocument/${requestId}`, documentData);
      }

      if (response.status === 200) {
        documentIds.push(response.data.Body.DocumentFileId);
      } else {
        throw new Error('Failed to upload selfie');
      }
    }

    // Process ID document
    if (req.files.idDocument) {
      const idFile = req.files.idDocument[0];
      uploadedFiles.push(idFile.path);

      const base64Data = fs.readFileSync(idFile.path).toString('base64');

      // Determine document type based on filename or default to passport
      let docType = "PassportScanURL";
      if (idFile.originalname.toLowerCase().includes('id') ||
          idFile.originalname.toLowerCase().includes('identity')) {
        docType = "IdentityCardURL";
      }

      const documentData = {
        Source: "Person",
        SourceKey: contactCode,
        DocumentDefinitionCode: docType,
        Description: "Uploaded from mobile app",
        File: {
          Name: idFile.originalname,
          Base64: base64Data
        }
      };

      let response;
      if (process.env.USE_MOCK_API === 'true') {
        response = documentMocks.createDocument();
      } else {
        const requestId = uuid();
        response = await aspektClient.post(`/api/createDocument/${requestId}`, documentData);
      }

      if (response.status === 200) {
        documentIds.push(response.data.Body.DocumentFileId);
      } else {
        throw new Error('Failed to upload ID document');
      }
    }

    res.json({
      success: true,
      documentIds
    });

  } catch (error) {
    console.error('Document upload error:', error.message);
    res.status(500).json({ error: 'Failed to upload documents' });
  } finally {
    // Clean up temporary files
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

module.exports = router;