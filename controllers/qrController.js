const crypto = require('crypto');
const db = require('../utils/database');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oidc');
require('dotenv').config();

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
    
    // Generate unique tracking ID
    const trackingId = crypto.randomBytes(8).toString('hex');
    
    // Store in PostgreSQL using pg
    const query = `
      INSERT INTO qr_codes (id, target_url, with_logo, created_at)
      VALUES ($1, $2, $3, $4)
    `;
    
    await db.query(query, [
      trackingId, 
      url, 
      withLogo,
      new Date()
    ]);
    
    // Create tracking URL
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
    
    //qr code info from psql
    const query = `SELECT id , target_url , with_logo , created_at FROM qr_codes WHERE id=$1`
    const {rows: qrInfo} = await db.query(query,[id]);

    if (!qrInfo || qrInfo.length === 0) {
      return res.status(404).json({ error: 'QR code not found' });
    }
    

    //analytics data from psql
    const analyticsQuery = `SELECT * FROM get_qr_analytics($1)`
    const {rows: analyticsData} = await db.query(analyticsQuery,[id]);
     
    // daily scan from psql
    const dailyScansQuery = `SELECT * FROM get_daily_scans($1)`;
    const { rows: dailyScans } = await db.query(dailyScansQuery, [id]);
    
    // Helper function to convert dates to IST format strings
    const formatToIST = (dateInput) => {
      if (!dateInput) return null;
      
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;
      
      // Format to IST (UTC+5:30)
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
    
    // Format dates in IST format
    const formattedQrInfo = {
      ...qrInfo[0],
      created_at: formatToIST(qrInfo[0].created_at)
    };
    
    const formattedAnalyticsData = {
      ...analyticsData[0],
      get_qr_analytics: {
        ...analyticsData[0].get_qr_analytics,
        last_scan: formatToIST(analyticsData[0].get_qr_analytics.last_scan)
      }
    };
    
    const formattedDailyScans = dailyScans.map(day => ({
      ...day,
      date: formatToIST(day.date).split(',')[0], // Only keep the date part for daily scans
      scans: parseInt(day.scans) // Convert string to number
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

exports.getHistory = async (req, res ,next) =>{
  try {
    const query = `SELECT * FROM qr_codes ORDER BY created_at DESC`;
    const { rows : data } = await db.query(query);
    res.json(data);
    logger.info('QR code history fetched successfully');
  } catch (error) {
    next(error);
    res.status(500).json({ error: 'Failed to fetch QR history' });
  }
}

exports.saveImage = async (req, res , next) => {
       try {
          const { imageData, fileName } = req.body;
          
          if (!imageData || !fileName) {
            return res.status(400).json({ error: 'Missing required parameters' });
          }
      
          // Define the assets directory path
          const assetsDir = path.join(process.cwd(), 'assets');
          
          // Create directory if it doesn't exist
          if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
          }
          
          // Write the image file
          const filePath = path.join(assetsDir, fileName);
          fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));
          
          // Return the relative path to the client
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

    // Check if the QR code exists
    const qrCheckQuery = `SELECT id FROM qr_codes WHERE id=$1`;
    const { rows: qrCheck } = await db.query(qrCheckQuery, [id]);

    if (!qrCheck.length) {
      return res.status(404).json({ error: 'QR code not found' });
    }


    await db.query(`DELETE FROM analytics WHERE qr_code_id = $1`, [id]);


    await db.query(`DELETE FROM qr_codes WHERE id = $1`, [id]);


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
    scope: ['profile'] 
  })(req, res, next);
};

exports.authenticateActual = (req, res, next) => {
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/login'
  })(req, res, next);
};
