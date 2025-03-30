const express = require('express');
const qrRoutes = require('./qrRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/qr', qrRoutes);

module.exports = router;