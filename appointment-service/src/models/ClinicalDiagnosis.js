const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A structured diagnosis belongs to exactly one patient and the configured clinic dentist.
const ClinicalDiagnosis = sequelize.define('ClinicalDiagnosis', {
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
  toothNumber: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  diagnosis: {
    type: DataTypes.STRING(180),
    allowNull: false
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },
  status: {
    type: DataTypes.ENUM('active', 'monitoring', 'resolved'),
    allowNull: false,
    defaultValue: 'active'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['doctorId', 'patientId', 'createdAt'] },
    { fields: ['patientId', 'status'] }
  ]
});

module.exports = ClinicalDiagnosis;
