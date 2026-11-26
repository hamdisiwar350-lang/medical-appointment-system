const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AppointmentCheckIn = sequelize.define('AppointmentCheckIn', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Appointments', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  checkedInBy: {
    type: DataTypes.UUID,
    allowNull: false
  },
  arrivedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('waiting', 'called', 'in_consultation', 'completed', 'left'),
    allowNull: false,
    defaultValue: 'waiting'
  },
  source: {
    type: DataTypes.ENUM('appointment', 'walk_in'),
    allowNull: false,
    defaultValue: 'appointment'
  },
  calledAt: { type: DataTypes.DATE, allowNull: true },
  startedAt: { type: DataTypes.DATE, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true }
}, {
  timestamps: true,
  indexes: [
    { fields: ['doctorId', 'status', 'arrivedAt'] },
    { unique: true, fields: ['appointmentId'] }
  ]
});

module.exports = AppointmentCheckIn;
