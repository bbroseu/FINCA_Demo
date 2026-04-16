const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

const client = axios.create({
  baseURL: process.env.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Username': process.env.MERCHANT_USERNAME,
    'ApiKey': process.env.MERCHANT_API_KEY,
  },
  httpsAgent: agent
});

module.exports = client;