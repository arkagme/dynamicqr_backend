const crypto = require('crypto');
const db = require('../utils/database');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oidc');
require('dotenv').config();
const axios = require('axios')
const QRCode = require('../models/qrcode');
const Analytics = require('../models/analytics')
const UserLogo = require('../models/userlogos')
const { sequelize } = require('../utils/database')

exports.generateQR = async (req, res, next) => {
  try {
    const { url, isDynamic, withLogo } = req.body;
    
    if (!isDynamic) {
      return res.json({ 
        url,
        isDynamic: false,
        trackingId: null
      });
    }
    
    const trackingId = crypto.randomBytes(8).toString('hex');
    
    await QRCode.create({
      id: trackingId,
      target_url: url,
      with_logo: withLogo,
      created_at: new Date(),
      user_id: req.user.id
    });
    
    const baseUrl = process.env.BASE_URL ||`${req.protocol}://${req.get('host')}`;
    const trackingUrl = `${baseUrl}/r/${trackingId}`;
    
    res.json({
      url: trackingUrl,
      isDynamic: true,
      trackingId
    });

    logger.info('QR code generated successfully');
  } catch (error) {
    next(error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};

exports.getAnalytics = async (req, res , next) => {
  try {
    const { id } = req.params;

    const qrInfo = await QRCode.findByPk(id);

    if (!qrInfo) {
      return res.status(404).json({ error: 'QR code not found' });
    }
    
    const analyticsData = await sequelize.query(
      'SELECT * FROM get_qr_analytics(:id)',
      {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const dailyScans = await sequelize.query(
      'SELECT * FROM get_daily_scans(:id)',
      {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const formatToIST = (dateInput) => {
      if (!dateInput) return null;
      
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;
      
      return date.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    };

    const formattedQrInfo = {
      ...qrInfo.toJSON(),
      created_at: formatToIST(qrInfo.created_at)
    };

    const formattedAnalyticsData = {
      ...analyticsData[0],
      get_qr_analytics: {
        ...analyticsData[0]?.get_qr_analytics,
        last_scan: formatToIST(analyticsData[0]?.get_qr_analytics?.last_scan)
      }
    };

    const formattedDailyScans = dailyScans.map(day => ({
      ...day,
      date: formatToIST(day.date).split(',')[0], 
      scans: parseInt(day.scans) 
    }));

    res.json({
      qr: formattedQrInfo,
      stats: formattedAnalyticsData,
      dailyScans: formattedDailyScans
    });

    logger.info('QR code analytics fetched successfully');
  } catch (error) {
    next(error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};


exports.getHistory = async (req, res, next) => {
  try {
    const data = await QRCode.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']]
    });
    res.json(data);
    logger.info('QR code history fetched successfully');
  } catch (error) {
    next(error);
    res.status(500).json({ error: 'Failed to fetch QR history' });
  }
};

exports.getAllHistory = async (req, res, next) => {
  try {
    const data = await QRCode.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(data);
    logger.info('QR code of all users history fetched successfully');
  } catch (error) {
    next(error);
    res.status(500).json({ error: 'Failed to fetch QR history' });
  }
};

exports.saveImage = async (req, res , next) => {
       try {
          const { imageData, fileName } = req.body;
          
          if (!imageData || !fileName) {
            return res.status(400).json({ error: 'Missing required parameters' });
          }
      
          const assetsDir = path.join(process.cwd(), 'assets');
          
          if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
          }

          const filePath = path.join(assetsDir, fileName);
          fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));
          
          const relativePath = `/assets/${fileName}`;
          
          res.status(200).json({ 
            success: true, 
            path: relativePath,
            message: 'QR code image saved successfully'
          });
          logger.info('QR code image saved successfully');
          
        } catch (error) {
          next(error);
          return res.status(500).json({ 
            error: 'Failed to save QR code image',
            details: error.message
          });
        }
}

exports.deleteQR = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if QR code exists
    const qrCheck = await QRCode.findOne({ where: { id } });

    if (!qrCheck) {
      return res.status(404).json({ error: 'QR code not found' });
    }

    // Delete related analytics
    await Analytics.destroy({ where: { qr_code_id: id } });

    // Delete QR code record
    await QRCode.destroy({ where: { id } });

    // Delete QR image file if exists
    const imagePath = path.join(process.cwd(), 'assets', `${id}.png`);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      logger.info(`Deleted QR code image: ${imagePath}`);
    }

    res.json({ success: true, message: 'QR code deleted successfully' });
    logger.info(`QR code ${id} deleted successfully`);
  } catch (error) {
    next(error);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
};


exports.authenticateRedirect = (req, res, next) => {
  passport.authenticate('google', { 
    scope: ['profile','email'] 
  })(req, res, next);
};

exports.authenticateActual = (req, res, next) => {
  passport.authenticate('google', {
    successRedirect: 'https://qr.arkagme.me/',
    failureRedirect: '/login'
  })(req, res, next);
};

exports.getMe = (req,res,next) => {
    res.status(200).json({ user: req.user });
}

exports.getUserLogos = async (req, res, next) => {
  try {
    const infoUrl = process.env.ME_URI;
    const userResponse = await axios.get(infoUrl, {
      headers: {
        cookie: req.headers.cookie
      }
    });

    const user = userResponse.data.user;

    // Sequelize query replacing raw SQL
    const rows = await UserLogo.findAll({
      where: { user_id: user.id },
      order: [['uploaded_at', 'DESC']],
      attributes: ['share_id', 'direct_url']
    });

    const formattedLogos = rows.map((logo) => ({
      url: logo.direct_url,
      share_id: logo.share_id
    }));

    res.json({
      success: true,
      logos: formattedLogos
    });

    logger.info(`User logos fetched successfully for user ${user.id}`);
  } catch (error) {
    next(error);
    res.status(500).json({ error: 'Failed to fetch user logos' });
  }
};


exports.deleteUserLogo = async (req, res, next) => {
  try {
    const { logoId } = req.params;
    const infoUrl = process.env.ME_URI;
    const userResponse = await axios.get(infoUrl, {
      headers: {
        cookie: req.headers.cookie
      }
    });

    const user = userResponse.data.user;

    // Check if logo exists for the user
    const rows = await UserLogo.findAll({
      where: { share_id: logoId, user_id: user.id }
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Logo not found or unauthorized' });
    }

    // Delete logo by share_id
    await UserLogo.destroy({ where: { share_id: logoId } });

    res.json({
      success: true,
      message: 'Logo deleted successfully'
    });

    logger.info(`Logo ${logoId} deleted successfully for user ${user.id}`);
  } catch (error) {
    next(error);
    res.status(500).json({ error: 'Failed to delete logo' });
  }
};
