const express = require('express');
const paymentService = require('../services/paymentService');
const router = express.Router();

router.get('/start', (req, res) => {
  const { amount, orderId } = req.query;

  try {
    const paymentForm = paymentService.generatePaymentForm(amount, orderId);
    res.send(paymentForm);
  } catch (error) {
    res.status(400).send(error.message);
  }
}); 

router.post('/response', (req, res) => {
  const result = paymentService.processPaymentResponse(req.body);

  if (!result.success && result.message.includes('Security Alert')) {
    return res.send(result.html);
  }

  res.send(result.html);
});

router.post('/callback', (req, res) => {
  const result = paymentService.processCallback(req.body);

  if (!result.success && result.error) {
    return res.status(400).send(result.error);
  }

  res.status(200).send('OK');
});

module.exports = router;