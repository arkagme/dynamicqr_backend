const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');
const User = require('../models/users')

const FederatedCredential = sequelize.define('FederatedCredential', {
  provider: 
  { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  subject: 
  { 
    type: DataTypes.STRING, 
    allowNull: false 
  }
});

FederatedCredential.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(FederatedCredential, { foreignKey: 'user_id' });

module.exports = FederatedCredential;