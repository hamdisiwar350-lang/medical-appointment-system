const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClinicalNote = sequelize.define('ClinicalNote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['doctorId', 'patientId', 'createdAt'] },
    { fields: ['appointmentId'] }
  ]
});

module.exports = ClinicalNote;
