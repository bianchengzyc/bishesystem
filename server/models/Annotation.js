const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Image = require('./Image');
const User = require('./User');

const Annotation = sequelize.define('Annotation', {
    annotation_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    image_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Image,
            key: 'image_id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'user_id'
        }
    },
    x: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    y: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    width: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    height: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    label_class: {
        type: DataTypes.TINYINT,
        defaultValue: 0
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'annotations',
    timestamps: false
});

Annotation.belongsTo(Image, { foreignKey: 'image_id' });
Annotation.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Annotation;