const passport = require('passport');
const GoogleStrategy = require('passport-google-oidc');
const db = require('../utils/database');
require('dotenv').config();



module.exports = function setupPassport(app){

    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
        cb(null, { id: user.id, username: user.username, name: user.name });
        });
    });

    passport.deserializeUser(function(user, cb) {
        process.nextTick(function() {
            return cb(null, user);
        });
    });

    passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/qr/oauth2/redirect/google', // Make sure this matches your route
    scope: ['profile']
  }, async function verify(issuer, profile, cb) {
    try {
      // Check if user exists
      const result = await db.query(
        'SELECT * FROM federated_credentials WHERE provider = $1 AND subject = $2',
        [issuer, profile.id]
      );
      
      if (result.rows.length === 0) {
        // Create new user
        const userResult = await db.query(
          'INSERT INTO users (name) VALUES ($1) RETURNING id',
          [profile.displayName]
        );
        
        const userId = userResult.rows[0].id;
        
        // Create credentials
        await db.query(
          'INSERT INTO federated_credentials (user_id, provider, subject) VALUES ($1, $2, $3)',
          [userId, issuer, profile.id]
        );
        
        return cb(null, { id: userId, name: profile.displayName });
      } else {
        // Get existing user
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
