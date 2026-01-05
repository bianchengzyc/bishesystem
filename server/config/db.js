const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// 使用SQLite数据库
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: false
});

module.exports = sequelize;