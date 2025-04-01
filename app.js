const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { errorHandler } = require('./middleware');
const routes = require('./routes');
const logger = require('./utils/logger');
const db = require('./utils/database');



const qrRoutes = require('./routes/index');


const app = express();


app.use(cors());
app.use(express.json());


app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });

app.use('/api', qrRoutes);

app.use('/api/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.json({
      message: 'Dynamic QR API',
      version: '1.0.0'
    });
  });

app.get('/r/:id', async (req, res) => {
    // Get tracking ID from the URL path
    const trackingId = req.params.id;
    logger.info(trackingId);
    if (!trackingId) {
      return res.status(404).send('Invalid tracking ID');
    }
  
    try {
  
      //target url from psql db
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
          logger.info(`Redirecting ${trackingId} to ${target_url}`);
  
          const logQuery = `
          INSERT INTO analytics (qr_code_id, user_agent, ip_address, timestamp) 
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
 });

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found'
      }
    });
  });

app.use(errorHandler);


module.exports = app;