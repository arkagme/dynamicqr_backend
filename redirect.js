//redundant file , not used , kept for reference
const express = require('express');
const cors = require('cors');
const db = require('./utils/database');
const logger = require('./utils/logger');

const app = express();
app.use(cors());
app.use(express.json());

 
const handler = async (req, res) => {
  // Get tracking ID from the URL path
  const trackingId = req.url.split('/r/')[1];
  logger.info(trackingId);
  if (!trackingId) {
    return res.status(404).send('Invalid tracking ID');
  }

  try {


        const query = `
          SELECT target_url FROM qr_codes WHERE id = $1
        `;
        
        const {rows: data} = await db.query(query,[trackingId]);
        logger.info(data)
        console.log(data)
        if (!data || data.length === 0) {
          return res.status(404).send('QR code not hehe found');
        }

        const target_url = data[0].target_url;
        logger.info(target_url )

        const logQuery = `
        INSERT INTO analytics (qr_code_id, user_agent, ip_address, scanned_at) 
        VALUES ($1, $2, $3, $4)
        `;
  
      await db.query(logQuery, [
        trackingId,
        req.headers['user-agent'],
        req.ip,
        new Date()
      ]);
    
    

    return res.redirect(target_url);
  } catch (error) {
    console.error('Redirect error:', error);
    return res.status(500).send('Server error');
  }
};

// Mount 
app.get('/r/:id', handler);

module.exports = app;