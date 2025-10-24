const app = require('./app');
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const { syncDatabase } = require('./utils/database');
const logger = require('./utils/logger');

const startApp = async () => {
  try {
    await syncDatabase();
    app.listen(PORT);
    logger.info(`Server started on port ${PORT}`);
  } catch (error) {
    logger.error(`Database connection failed: ${error}`);
    process.exit(1);
  }
};

startApp();