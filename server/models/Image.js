const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./User');

const Image = sequelize.define('Image', {
  image_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  capture_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  resolution: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  crs: {
    type: DataTypes.STRING(50),
    defaultValue: 'EPSG:32632'
  },
  image_width: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  image_height: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'user_id'
    }
  },
  uploaded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'images',
  timestamps: false
});

Image.belongsTo(User, { foreignKey: 'uploaded_by' });

module.exports = Image;

// Define hasMany relationship after module exports to avoid circular dependency
Image.hasMany(require('./Annotation'), { foreignKey: 'image_id' });