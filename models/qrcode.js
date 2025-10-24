const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');
const User = require('../models/users')

const QRCode = sequelize.define('QRCode', {
  id: 
  {
    type: DataTypes.STRING,
    primaryKey: true
  },
  target_url: 
  { 
    type: DataTypes.STRING, 
    allowNull: false 
 },
  with_logo: 
  { 
    type: DataTypes.BOOLEAN, 
    allowNull: false, 
    defaultValue: false 
  },
  created_at: 
  { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.NOW 
  }
});

QRCode.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(QRCode, { foreignKey: 'user_id' });

module.exports = QRCode