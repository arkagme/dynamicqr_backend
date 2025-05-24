const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20');
const db = require('../utils/database');
require('dotenv').config();
const logger = require('../utils/logger');


// Authentication middleware
exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized - Please log in first' });
};

// Conditional QR auth middleware
exports.checkDynamicAuth = (req, res, next) => {
  if (req.body.isDynamic) {
    return exports.ensureAuthenticated(req, res, next);
  }
  next();
};


exports.setupPassport = function setupPassport(app){
    app.set('trust proxy',1);

    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
        cb(null, { id: user.id, username: user.username, name: user.name , role: user.role , email:user.email});
        });
    });

    passport.deserializeUser(function(user, cb) {
        process.nextTick(function() {
            return cb(null, user);
        });
    });

    const callbackURL = process.env.NODE_ENV === 'production'? 
    process.env.REDIRECT_URI || 'https://qrapi.arkagme.biz/api/qr/oauth2/redirect/google'
    : 'http://localhost:3000/api/qr/oauth2/redirect/google';

    passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL ,
    scope: ['profile','email']
  }, async function verify(accessToken, refreshToken, profile, cb) {
    try {
      const result = await db.query(
        'SELECT * FROM federated_credentials WHERE provider = $1 AND subject = $2',
        ['google', profile.id]
      );
      
      if (result.rows.length === 0) {
        const userResult = await db.query(
          'INSERT INTO users (name,email) VALUES ($1, $2) RETURNING id',
          [profile.displayName , profile.emails && profile.emails[0] ? profile.emails[0].value : null]
        );
        
        const userId = userResult.rows[0].id;
        await db.query(
          'INSERT INTO federated_credentials (user_id, provider, subject) VALUES ($1, $2, $3)',
          [userId, 'google', profile.id]
        );

        return cb(null, { id: userId, name: profile.displayName , email: profile.emails[0].value });
      } else {
        // existing user
        const userResult = await db.query(
          'SELECT * FROM users WHERE id = $1',
          [result.rows[0].user_id]
        );
        
        if (userResult.rows.length === 0) {
          return cb(null, false);
        }
        
        return cb(null, userResult.rows[0]);
      }
    } catch (err) {
      return cb(err);
    }
}));

}

exports.ownsQR = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }
    const { rows } = await db.query(
      'SELECT user_id FROM qr_codes WHERE id = $1',
      [req.params.id]
    );
    
    if (!rows.length || rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

exports.isAdmin = async (req,res,next) => {
    req.user.role === 'admin'
    ? next()
    : res.status(403).json({ error: 'Admin access required' });
}

