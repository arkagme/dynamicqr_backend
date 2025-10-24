const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20');
const db = require('../utils/database');
require('dotenv').config();
const logger = require('../utils/logger');
const FederatedCredential = require('../models/credentials');
const User = require('../models/users')
const QRCode = require('../models/qrcode');


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
    process.env.REDIRECT_URI || 'https://qrapi.arkagme.me/api/qr/oauth2/redirect/google'
    : 'http://localhost:3000/api/qr/oauth2/redirect/google';

    passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL ,
    scope: ['profile','email'],
  }, async function verify(accessToken, refreshToken, profile, cb) {
    try {

      console.log('Google Profile:', JSON.stringify(profile, null, 2));
      console.log('Profile emails:', profile.emails[0].value);
      const result = await FederatedCredential.findOne({
        where: { provider: 'google', subject: profile.id }
      });
      if (!result) {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        const userResult = await User.create({ name: profile.displayName, email })
        
        const newUser = userResult;
        console.log('Created user:', newUser);
        await FederatedCredential.create({
          user_id: newUser.id,
          provider: 'google',
          subject: profile.id
        });

        return cb(null, { id: newUser.id, name: profile.displayName , email : email  ,role: 'user' });
      } else {
        // existing user
        const userResult = await User.findByPk(result.user_id);
        
        if (!userResult) {
          return cb(null, false);
        }
        
        return cb(null, userResult);
      }
    } catch (err) {
      console.error('OAuth error:', err)
      return cb(err);
    }
}));

}

exports.ownsQR = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }
    const  rows  = await QRCode.findAll({
    attributes: ['user_id'],
    where: { id: req.params.id }
  });
    
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

