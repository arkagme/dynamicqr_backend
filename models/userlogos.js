const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');
const User = require('../models/users')

const UserLogo = sequelize.define('UserLogo', {
  user_email: 
  { 
    type: DataTypes.STRING, 
    allowNull: false 
},
  filename: 
  { 
    type: DataTypes.STRING,
    allowNull: false 
},
  direct_url: 
  { 
    type: DataTypes.STRING, 
    allowNull: false },
  share_id: 
  { 
    type: DataTypes.STRING, 
    allowNull: false 
}, 
  file_id: 
  { 
    type: DataTypes.STRING, 
    allowNull: false 
},
  uploaded_at: 
  { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: Sequelize.NOW 
}
});
UserLogo.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(UserLogo, { foreignKey: 'user_id' });

module.exports = UserLogo;