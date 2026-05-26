const express = require('express');
const cors = require('cors');
const path = require('path');

const passport = require('./middleware/passport');

const contactRoutes = require('./routes/contact');
const documentRoutes = require('./routes/document');
const leadRoutes = require('./routes/lead');
const paymentRoutes = require('./routes/payment');
const loanRoutes = require('./routes/loan');
const scormRoutes = require('./routes/scorm');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const customerAuthRoutes = require('./routes/customerAuth');

function buildApp() {
  const app = express();

  app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.static('client'));

  app.use(passport.initialize());

  app.use('/api/auth', authRoutes);
  app.use('/api/customer/auth', customerAuthRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/document', documentRoutes);
  app.use('/api/lead', leadRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/loan', loanRoutes);
  app.use('/api/scorm', scormRoutes);

  app.use('/scorm', express.static(path.resolve(process.cwd(), 'storage', 'scorm')));

  return app;
}

module.exports = buildApp;
