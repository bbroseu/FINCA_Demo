require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const contactRoutes = require('./routes/contact');
const documentRoutes = require('./routes/document');
const leadRoutes = require('./routes/lead');
const paymentRoutes = require('./routes/payment');
const ocrRoutes = require('./routes/ocr');
const loanRoutes = require('./routes/loan');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('client'));

app.use('/api/contact', contactRoutes);
app.use('/api/document', documentRoutes);
app.use('/api/lead', leadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/loan', loanRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`FINCA Demo server running on port ${PORT}`);
  console.log(`Mock API mode: ${process.env.USE_MOCK_API === 'true' ? 'ENABLED' : 'DISABLED'}`);
});