const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');
const QRCode = require('../models/qrcode');

const Analytics = sequelize.define('Analytics', {
  user_agent: 
  { 
    type: DataTypes.STRING, 
    allowNull: false 
},
  ip_address: 
  { 
    type: DataTypes.STRING, 
    allowNull: false 
},
  timestamp: 
  { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.NOW }
});

Analytics.belongsTo(QRCode, { foreignKey: 'qr_code_id', onDelete: 'CASCADE' });
QRCode.hasMany(Analytics, { foreignKey: 'qr_code_id' });

module.exports = Analytics