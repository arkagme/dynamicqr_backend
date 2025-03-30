const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('API Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });
  if (res.headersSent) {
    return next(err);
  }
  
  const statusCode = err.statusCode;
  const errorMessage = err.message;
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code ,
      message: errorMessage
    }
  });
};

module.exports = errorHandler;