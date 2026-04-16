const express = require('express');
const upload = require('../middleware/upload');
const ocrService = require('../services/ocrService');
const fs = require('fs');

const router = express.Router();

// OCR endpoint for processing uploaded images
router.post('/scan', upload.single('image'), async (req, res) => {
  let filePath = null;

  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    filePath = req.file.path;

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are supported' });
    }

    // Get API configuration from environment variables
    const apiUrl = process.env.CLOUD_VISION_URL;
    const apiKey = process.env.CLOUD_VISION_API_KEY;

    if (!apiUrl || !apiKey) {
      return res.status(500).json({
        error: 'OCR service not configured. Missing API URL or API key.'
      });
    }

    // Read the uploaded file
    const imageBuffer = fs.readFileSync(req.file.path);

    // Process image with OCR
    const result = await ocrService.scanImage(imageBuffer, apiUrl, apiKey);

    if (result.success) {
      return res.json({
        success: true,
        text: result.text,
        fileName: req.file.originalname
      });
    } else {
      return res.status(422).json({
        error: 'OCR processing failed',
        details: result.error
      });
    }

  } catch (error) {
    console.error('OCR route error:', error.message);
    return res.status(500).json({
      error: 'Internal server error during OCR processing'
    });

  } finally {
    // Clean up temporary file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', filePath, cleanupError.message);
      }
    }
  }
});

module.exports = router;