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
const QRCode = require('./models/qrcode');
const Analytics = require('./models/analytics')


const qrRoutes = require('./routes/index');


const app = express();


app.use(cors({
    origin: ['https://qr.arkagme.me','http://localhost:5173']    ,
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
    tableName: 'sessions'  
  }),
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
}));
setupPassport(app);

app.use('/api', qrRoutes);

app.use('/api/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.json({
      message: 'Dynamic QR API',
      version: '1.0.0'
    });
  });

app.set('trust proxy', true);


function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }
  if (req.connection && req.connection.socket && req.connection.socket.remoteAddress) {
    return req.connection.socket.remoteAddress;
  }
  return req.ip;
}


app.get('/r/:id', async (req, res) => {
  // tracking ID from the URL path
  const trackingId = req.params.id;
  logger.info(trackingId);
  if (!trackingId) {
    return res.status(404).send('Invalid tracking ID');
  }

  try {
    // Get target URL from QRCode model
    const qrCode = await QRCode.findByPk(trackingId, {
      attributes: ['target_url']
    });

    if (!qrCode) {
      return res.status(404).send('QR code not hehe found');
    }

    const target_url = qrCode.target_url;
    logger.info(`Redirecting ${trackingId} to ${target_url}`);
    logger.info(getClientIp(req));
    logger.info(req.headers['user-agent'])
    logger.info(trackingId)
    // Insert analytics record
    await Analytics.create({
      qr_code_id: trackingId,
      user_agent: req.headers['user-agent'],
      ip_address: req.ip,
      timestamp: new Date()
    });

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