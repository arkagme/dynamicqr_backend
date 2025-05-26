const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { errorHandler } = require('./middleware');
const routes = require('./routes');
const logger = require('./utils/logger');
const db = require('./utils/database');
var session = require('express-session');
var pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const config = require('./config');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oidc');
const { setupPassport } = require('./middleware/auth');



const qrRoutes = require('./routes/index');


const app = express();


app.use(cors({
    origin: ['https://qr.arkagme.biz','http://localhost:5173']    ,
    credentials: true 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });


const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password
});
app.use(session({
  store: new pgSession({
    pool: pool,           // Connection pool
    tableName: 'sessions'  // Use a custom table name (default is "session")
  }),
  secret: process.env.SESSION_SECRET || 'keyboard cat', // Use environment variable in production
  resave: false,
  saveUninitialized: false,
}));
setupPassport(app);

app.use('/api', qrRoutes);

const assetsRouter = express.Router();
assetsRouter.use(cors({
  origin: ['https://qr.arkagme.biz', 'http://localhost:5173'],
  credentials: true
}));
assetsRouter.use(express.static(path.join(__dirname, 'assets')));
app.use('/api/assets', assetsRouter);

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