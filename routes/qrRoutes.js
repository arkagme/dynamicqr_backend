const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController.js');
const fs = require('fs');
const path = require('path');

router.post('/generate', qrController.generateQR);
router.get('/analytics/:id', qrController.getAnalytics);
router.get('/history', qrController.getHistory);
router.post('/saveImage', qrController.saveImage);
  
module.exports = router;