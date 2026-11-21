const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Doctor = sequelize.define('Doctor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  specialty: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  phone: {
    type: DataTypes.STRING
  },
  availableFrom: {
    type: DataTypes.STRING,
    defaultValue: '09:00'
  },
  availableTo: {
    type: DataTypes.STRING,
    defaultValue: '17:00'
  }
}, { timestamps: true });

module.exports = Doctor;
