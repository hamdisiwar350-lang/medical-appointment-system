const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// One private clinical file per real patient who has an appointment at this clinic.
// patientId/doctorId are UUIDs from the User Service; the databases are separate,
// so the relationship is validated against this clinic's appointment records.
const PatientClinicalRecord = sequelize.define('PatientClinicalRecord', {
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
  medicalHistory: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },
  allergies: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },
  medications: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },
  odontogram: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  timestamps: true,
  indexes: [{
    unique: true,
    name: 'unique_clinical_record_doctor_patient',
    fields: ['doctorId', 'patientId']
  }]
});

module.exports = PatientClinicalRecord;
