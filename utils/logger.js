const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'dynamicqr-backend' },
    transports: [
    // Always add console transport
    new winston.transports.Console({
      format: config.env !== 'production' 
        ? winston.format.combine(winston.format.colorize(), winston.format.simple())
        : winston.format.json()
    })
  ]
});
module.exports = logger;