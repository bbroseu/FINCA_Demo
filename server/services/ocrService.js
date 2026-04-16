const axios = require("axios");

const scanImage = async (imageBuffer, apiUrl, apiKey) => {
  if (!imageBuffer || !apiUrl || !apiKey) {
    throw new Error('Missing required parameters: imageBuffer, apiUrl, and apiKey are required');
  }

  const base64Image = imageBuffer.toString("base64");

  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  };

  const headers = {
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.post(
      `${apiUrl}${apiKey}`,
      body,
      { headers }
    );

    if (!response.data?.responses?.[0]?.fullTextAnnotation?.text) {
      return { success: false, error: 'No text detected in image' };
    }

    return {
      success: true,
      text: response.data.responses[0].fullTextAnnotation.text
    };
  } catch (error) {
    console.error('OCR Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'OCR processing failed'
    };
  }
};

module.exports = {
  scanImage
};