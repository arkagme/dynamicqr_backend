const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController.js');
const fs = require('fs');
const auth = require('../middleware/auth.js')

router.post('/generate', auth.checkDynamicAuth , qrController.generateQR);
router.get('/analytics/:id',auth.ensureAuthenticated , auth.ownsQR , qrController.getAnalytics);
router.get('/history', auth.ensureAuthenticated , qrController.getHistory);
router.post('/saveImage', qrController.saveImage);
router.delete('/:id', auth.ensureAuthenticated , auth.ownsQR , qrController.deleteQR);
router.get('/admin/getallhistory',auth.ensureAuthenticated , auth.isAdmin , qrController.getAllHistory)
router.get('/login/federated/google',qrController.authenticateRedirect);
router.get('/oauth2/redirect/google',qrController.authenticateActual);
router.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});
  
module.exports = router;