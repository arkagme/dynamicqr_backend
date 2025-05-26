const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController.js');
const fs = require('fs');
const auth = require('../middleware/auth.js')
const logo = require('../controllers/logoController.js')

router.post('/generate', auth.checkDynamicAuth , qrController.generateQR);
router.get('/analytics/:id',auth.ensureAuthenticated , auth.ownsQR , qrController.getAnalytics);
router.get('/history', auth.ensureAuthenticated , qrController.getHistory);
router.post('/saveImage', qrController.saveImage);
router.delete('/:id', auth.ensureAuthenticated , auth.ownsQR , qrController.deleteQR);
router.get('/admin/getallhistory',auth.ensureAuthenticated , auth.isAdmin , qrController.getAllHistory)
router.get('/login/federated/google',qrController.authenticateRedirect);
router.get('/oauth2/redirect/google',qrController.authenticateActual);
router.get('/me', auth.ensureAuthenticated, qrController.getMe);
router.post('/uploadlogo',logo.logoauthController,logo.uploadlogoController,logo.handleLogoUpload);

router.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});
  
module.exports = router;