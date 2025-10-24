const { Sequelize } = require('sequelize');
const config = require('../config');
const logger = require('../utils/logger');

const sequelize = new Sequelize({
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  host: config.database.host,
  port : config.database.port,
  dialect: config.database.dialect,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,  
    },
  },
});

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    await sequelize.sync();
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.log('Unable to connect to the database:', error);
  }
};

module.exports = {
  sequelize,
  syncDatabase,
};
