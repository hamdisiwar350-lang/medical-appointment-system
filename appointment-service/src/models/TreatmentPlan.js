const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Treatment items are retained as clinical history; completion/cancellation never deletes them.
const TreatmentPlan = sequelize.define('TreatmentPlan', {
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
  diagnosisId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  title: {
    type: DataTypes.STRING(180),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high'),
    allowNull: false,
    defaultValue: 'normal'
  },
  status: {
    type: DataTypes.ENUM('proposed', 'accepted', 'in_progress', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'proposed'
  },
  plannedDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['doctorId', 'patientId', 'createdAt'] },
    { fields: ['diagnosisId'] },
    { fields: ['patientId', 'status'] }
  ]
});

module.exports = TreatmentPlan;
