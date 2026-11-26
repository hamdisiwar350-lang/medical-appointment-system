const Appointment = require('../models/Appointment');
const PatientClinicalRecord = require('../models/PatientClinicalRecord');
const ClinicalNote = require('../models/ClinicalNote');
const ClinicalDiagnosis = require('../models/ClinicalDiagnosis');
const TreatmentPlan = require('../models/TreatmentPlan');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOOTH_NUMBERS = new Set([
  ...Array.from({ length: 8 }, (_, index) => 11 + index),
  ...Array.from({ length: 8 }, (_, index) => 21 + index),
  ...Array.from({ length: 8 }, (_, index) => 31 + index),
  ...Array.from({ length: 8 }, (_, index) => 41 + index)
]);
const TOOTH_STATUSES = new Set(['unreported', 'healthy', 'caries', 'filled', 'crown', 'missing']);
const MAX_PROFILE_FIELD = 5000;
const MAX_NOTE_LENGTH = 10000;
const MAX_DIAGNOSIS_DETAILS = 5000;
const MAX_PLAN_DESCRIPTION = 5000;
const DIAGNOSIS_STATUSES = new Set(['active', 'monitoring', 'resolved']);
const PLAN_STATUSES = new Set(['proposed', 'accepted', 'in_progress', 'completed', 'cancelled']);
const PLAN_PRIORITIES = new Set(['low', 'normal', 'high']);

function doctorContext(req, res) {
  const userId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  const clinicDoctorId = process.env.CLINIC_DOCTOR_ID;

  if (role !== 'doctor' || !userId) {
    res.status(403).json({ error: 'Only the clinic dentist can access clinical records' });
    return null;
  }
  if (!clinicDoctorId || userId !== clinicDoctorId) {
    res.status(403).json({ error: 'This account is not the configured clinic dentist' });
    return null;
  }
  return { doctorId: clinicDoctorId };
}

function validPatientId(patientId) {
  return typeof patientId === 'string' && UUID_RE.test(patientId);
}

async function appointmentsForPatient(doctorId, patientId) {
  return Appointment.findAll({
    where: { doctorId, patientId },
    order: [['appointmentDate', 'DESC']]
  });
}

async function ensureClinicalRecord(doctorId, patientId) {
  try {
    const [record] = await PatientClinicalRecord.findOrCreate({
      where: { doctorId, patientId },
      defaults: { doctorId, patientId, medicalHistory: '', allergies: '', medications: '', odontogram: {} }
    });
    return record;
  } catch (error) {
    // A concurrent first page load may create the same patient file.
    if (error.name === 'SequelizeUniqueConstraintError') {
      return PatientClinicalRecord.findOne({ where: { doctorId, patientId } });
    }
    throw error;
  }
}

function serializeAppointment(appointment) {
  return {
    id: appointment.id,
    appointmentDate: appointment.appointmentDate,
    status: appointment.status,
    createdAt: appointment.createdAt,
    requestMessage: appointment.notes || ''
  };
}

exports.getPatients = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;

  try {
    const appointments = await Appointment.findAll({
      where: { doctorId: context.doctorId },
      order: [['appointmentDate', 'DESC']]
    });

    const patientsById = new Map();
    for (const appointment of appointments) {
      const existing = patientsById.get(appointment.patientId);
      if (!existing) {
        patientsById.set(appointment.patientId, {
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          patientEmail: appointment.patientEmail,
          lastAppointment: appointment.appointmentDate,
          appointmentCount: 0,
          completedCount: 0
        });
      }
      const patient = patientsById.get(appointment.patientId);
      patient.appointmentCount += 1;
      if (appointment.status === 'completed') patient.completedCount += 1;
    }

    const patients = await Promise.all([...patientsById.values()].map(async patient => {
      const record = await ensureClinicalRecord(context.doctorId, patient.patientId);
      return { ...patient, recordId: record.id, recordUpdatedAt: record.updatedAt };
    }));

    return res.json({ count: patients.length, patients });
  } catch (error) {
    console.error('Get clinical patients error:', error.message);
    return res.status(500).json({ error: 'Unable to retrieve patient files' });
  }
};

exports.getPatientRecord = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;
  const { patientId } = req.params;
  if (!validPatientId(patientId)) return res.status(400).json({ error: 'Invalid patient ID' });

  try {
    const appointments = await appointmentsForPatient(context.doctorId, patientId);
    if (!appointments.length) return res.status(404).json({ error: 'Patient file not found for this clinic' });

    const record = await ensureClinicalRecord(context.doctorId, patientId);
    const [notes, diagnoses, treatmentPlans] = await Promise.all([
      ClinicalNote.findAll({
        where: { doctorId: context.doctorId, patientId },
        order: [['createdAt', 'DESC']]
      }),
      ClinicalDiagnosis.findAll({
        where: { doctorId: context.doctorId, patientId },
        order: [['createdAt', 'DESC']]
      }),
      TreatmentPlan.findAll({
        where: { doctorId: context.doctorId, patientId },
        order: [['createdAt', 'DESC']]
      })
    ]);
    const latest = appointments[0];

    return res.json({
      patient: {
        id: patientId,
        name: latest.patientName,
        email: latest.patientEmail
      },
      record: {
        id: record.id,
        medicalHistory: record.medicalHistory,
        allergies: record.allergies,
        medications: record.medications,
        odontogram: record.odontogram || {},
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      },
      notes: notes.map(note => ({
        id: note.id,
        note: note.note,
        appointmentId: note.appointmentId,
        createdAt: note.createdAt
      })),
      diagnoses: diagnoses.map(diagnosis => ({
        id: diagnosis.id,
        toothNumber: diagnosis.toothNumber,
        diagnosis: diagnosis.diagnosis,
        details: diagnosis.details,
        status: diagnosis.status,
        createdAt: diagnosis.createdAt,
        updatedAt: diagnosis.updatedAt
      })),
      treatmentPlans: treatmentPlans.map(plan => ({
        id: plan.id,
        diagnosisId: plan.diagnosisId,
        title: plan.title,
        description: plan.description,
        priority: plan.priority,
        status: plan.status,
        plannedDate: plan.plannedDate,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      })),
      appointments: appointments.map(serializeAppointment)
    });
  } catch (error) {
    console.error('Get patient clinical record error:', error.message);
    return res.status(500).json({ error: 'Unable to retrieve the clinical record' });
  }
};

exports.updatePatientRecord = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;
  const { patientId } = req.params;
  if (!validPatientId(patientId)) return res.status(400).json({ error: 'Invalid patient ID' });

  const allowedFields = ['medicalHistory', 'allergies', 'medications'];
  const body = req.body || {};
  const updates = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      if (typeof body[field] !== 'string' || body[field].length > MAX_PROFILE_FIELD) {
        return res.status(400).json({ error: `${field} must be text under ${MAX_PROFILE_FIELD} characters` });
      }
      updates[field] = body[field].trim();
    }
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid clinical fields were provided' });

  try {
    const appointments = await appointmentsForPatient(context.doctorId, patientId);
    if (!appointments.length) return res.status(404).json({ error: 'Patient file not found for this clinic' });
    const record = await ensureClinicalRecord(context.doctorId, patientId);
    await record.update(updates);
    return res.json({ message: 'Clinical profile saved', record: {
      id: record.id,
      medicalHistory: record.medicalHistory,
      allergies: record.allergies,
      medications: record.medications,
      updatedAt: record.updatedAt
    } });
  } catch (error) {
    console.error('Update patient clinical profile error:', error.message);
    return res.status(500).json({ error: 'Unable to save the clinical profile' });
  }
};

exports.createClinicalNote = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;
  const { patientId } = req.params;
  if (!validPatientId(patientId)) return res.status(400).json({ error: 'Invalid patient ID' });

  const noteText = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!noteText || noteText.length > MAX_NOTE_LENGTH) {
    return res.status(400).json({ error: `A clinical note is required (maximum ${MAX_NOTE_LENGTH} characters)` });
  }

  try {
    const appointments = await appointmentsForPatient(context.doctorId, patientId);
    if (!appointments.length) return res.status(404).json({ error: 'Patient file not found for this clinic' });
    let appointmentId = null;
    if (req.body.appointmentId) {
      const linkedAppointment = await Appointment.findOne({
        where: { id: req.body.appointmentId, doctorId: context.doctorId, patientId }
      });
      if (!linkedAppointment) return res.status(400).json({ error: 'Appointment does not belong to this patient' });
      appointmentId = linkedAppointment.id;
    }

    const note = await ClinicalNote.create({
      doctorId: context.doctorId,
      patientId,
      appointmentId,
      note: noteText,
      createdBy: context.doctorId
    });
    return res.status(201).json({ message: 'Clinical note saved', note: {
      id: note.id, note: note.note, appointmentId: note.appointmentId, createdAt: note.createdAt
    } });
  } catch (error) {
    console.error('Create clinical note error:', error.message);
    return res.status(500).json({ error: 'Unable to save the clinical note' });
  }
};

exports.updateToothFinding = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;
  const { patientId } = req.params;
  const toothParam = req.params.toothNumber;
  const toothNumber = Number(toothParam);
  if (!validPatientId(patientId)) return res.status(400).json({ error: 'Invalid patient ID' });
  if (!/^\d{2}$/.test(toothParam) || !TOOTH_NUMBERS.has(toothNumber)) {
    return res.status(400).json({ error: 'Invalid permanent FDI tooth number' });
  }

  const status = req.body?.status;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!TOOTH_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid tooth status' });
  if (note.length > 1000) return res.status(400).json({ error: 'Tooth note is too long' });

  try {
    const appointments = await appointmentsForPatient(context.doctorId, patientId);
    if (!appointments.length) return res.status(404).json({ error: 'Patient file not found for this clinic' });
    const record = await ensureClinicalRecord(context.doctorId, patientId);
    const odontogram = { ...(record.odontogram || {}) };
    if (status === 'unreported' && !note) {
      delete odontogram[String(toothNumber)];
    } else {
      odontogram[String(toothNumber)] = { status, note, updatedAt: new Date().toISOString() };
    }
    await record.update({ odontogram });
    return res.json({ message: 'Tooth finding saved', toothNumber, finding: odontogram[String(toothNumber)] || null });
  } catch (error) {
    console.error('Update odontogram error:', error.message);
    return res.status(500).json({ error: 'Unable to save tooth finding' });
  }
};


// Structured diagnoses and treatment plans are append/update-only clinical data.
// The API never deletes them so the patient's clinical history is retained.
async function requireClinicPatient(doctorId, patientId, res) {
  const appointments = await Appointment.findAll({
    where: { doctorId, patientId },
    attributes: ['id'],
    limit: 1
  });
  if (!appointments.length) {
    res.status(404).json({ error: 'Patient file not found for this clinic' });
    return false;
  }
  return true;
}

function serializeDiagnosis(diagnosis) {
  return {
    id: diagnosis.id,
    toothNumber: diagnosis.toothNumber,
    diagnosis: diagnosis.diagnosis,
    details: diagnosis.details,
    status: diagnosis.status,
    createdAt: diagnosis.createdAt,
    updatedAt: diagnosis.updatedAt
  };
}

function serializeTreatmentPlan(plan) {
  return {
    id: plan.id,
    diagnosisId: plan.diagnosisId,
    title: plan.title,
    description: plan.description,
    priority: plan.priority,
    status: plan.status,
    plannedDate: plan.plannedDate,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };
}

function validOptionalDate(value) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

exports.createDiagnosis = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;
  const { patientId } = req.params;
  if (!validPatientId(patientId)) return res.status(400).json({ error: 'Invalid patient ID' });

  const body = req.body || {};
  const diagnosisText = typeof body.diagnosis === 'string' ? body.diagnosis.trim() : '';
  const details = typeof body.details === 'string' ? body.details.trim() : '';
  const toothNumber = body.toothNumber === null || body.toothNumber === undefined || body.toothNumber === ''
    ? null : Number(body.toothNumber);
  const status = body.status || 'active';

  if (!diagnosisText || diagnosisText.length > 180) {
    return res.status(400).json({ error: 'Diagnosis is required (maximum 180 characters)' });
  }
  if (typeof body.details !== 'undefined' && (typeof body.details !== 'string' || details.length > MAX_DIAGNOSIS_DETAILS)) {
    return res.status(400).json({ error: `Diagnosis details must be text under ${MAX_DIAGNOSIS_DETAILS} characters` });
  }
  if (toothNumber !== null && (!Number.isInteger(toothNumber) || !TOOTH_NUMBERS.has(toothNumber))) {
    return res.status(400).json({ error: 'Invalid permanent FDI tooth number' });
  }
  if (!DIAGNOSIS_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid diagnosis status' });

  try {
    if (!await requireClinicPatient(context.doctorId, patientId, res)) return;
    const diagnosis = await ClinicalDiagnosis.create({
      doctorId: context.doctorId,
      patientId,
      toothNumber,
      diagnosis: diagnosisText,
      details,
      status,
      createdBy: context.doctorId
    });
    return res.status(201).json({ message: 'Diagnosis saved', diagnosis: serializeDiagnosis(diagnosis) });
  } catch (error) {
    console.error('Create clinical diagnosis error:', error.message);
    return res.status(500).json({ error: 'Unable to save the diagnosis' });
  }
};

exports.updateDiagnosis = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;
  const { patientId, diagnosisId } = req.params;
  if (!validPatientId(patientId) || !validPatientId(diagnosisId)) {
    return res.status(400).json({ error: 'Invalid patient or diagnosis ID' });
  }

  const updates = {};
  const body = req.body || {};
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (!DIAGNOSIS_STATUSES.has(body.status)) return res.status(400).json({ error: 'Invalid diagnosis status' });
    updates.status = body.status;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'details')) {
    if (typeof body.details !== 'string' || body.details.trim().length > MAX_DIAGNOSIS_DETAILS) {
      return res.status(400).json({ error: 'Invalid diagnosis details' });
    }
    updates.details = body.details.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'diagnosis')) {
    if (typeof body.diagnosis !== 'string' || !body.diagnosis.trim() || body.diagnosis.trim().length > 180) {
      return res.status(400).json({ error: 'Invalid diagnosis text' });
    }
    updates.diagnosis = body.diagnosis.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'toothNumber')) {
    const value = body.toothNumber === null || body.toothNumber === '' ? null : Number(body.toothNumber);
    if (value !== null && (!Number.isInteger(value) || !TOOTH_NUMBERS.has(value))) {
      return res.status(400).json({ error: 'Invalid permanent FDI tooth number' });
    }
    updates.toothNumber = value;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid diagnosis updates provided' });

  try {
    if (!await requireClinicPatient(context.doctorId, patientId, res)) return;
    const diagnosis = await ClinicalDiagnosis.findOne({ where: { id: diagnosisId, doctorId: context.doctorId, patientId } });
    if (!diagnosis) return res.status(404).json({ error: 'Diagnosis not found for this patient' });
    await diagnosis.update(updates);
    return res.json({ message: 'Diagnosis updated', diagnosis: serializeDiagnosis(diagnosis) });
  } catch (error) {
    console.error('Update clinical diagnosis error:', error.message);
    return res.status(500).json({ error: 'Unable to update the diagnosis' });
  }
};

exports.createTreatmentPlan = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;
  const { patientId } = req.params;
  if (!validPatientId(patientId)) return res.status(400).json({ error: 'Invalid patient ID' });

  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const priority = body.priority || 'normal';
  const plannedDate = body.plannedDate || null;
  const diagnosisId = body.diagnosisId || null;

  if (!title || title.length > 180) return res.status(400).json({ error: 'Treatment title is required (maximum 180 characters)' });
  if (typeof body.description !== 'undefined' && (typeof body.description !== 'string' || description.length > MAX_PLAN_DESCRIPTION)) {
    return res.status(400).json({ error: `Treatment description must be text under ${MAX_PLAN_DESCRIPTION} characters` });
  }
  if (!PLAN_PRIORITIES.has(priority)) return res.status(400).json({ error: 'Invalid treatment priority' });
  if (!validOptionalDate(plannedDate)) return res.status(400).json({ error: 'Invalid planned date (YYYY-MM-DD)' });
  if (diagnosisId && !validPatientId(diagnosisId)) return res.status(400).json({ error: 'Invalid diagnosis ID' });

  try {
    if (!await requireClinicPatient(context.doctorId, patientId, res)) return;
    if (diagnosisId) {
      const diagnosis = await ClinicalDiagnosis.findOne({ where: { id: diagnosisId, doctorId: context.doctorId, patientId } });
      if (!diagnosis) return res.status(400).json({ error: 'Diagnosis does not belong to this patient' });
    }
    const plan = await TreatmentPlan.create({
      doctorId: context.doctorId,
      patientId,
      diagnosisId,
      title,
      description,
      priority,
      status: 'proposed',
      plannedDate,
      createdBy: context.doctorId
    });
    return res.status(201).json({ message: 'Treatment plan saved', treatmentPlan: serializeTreatmentPlan(plan) });
  } catch (error) {
    console.error('Create treatment plan error:', error.message);
    return res.status(500).json({ error: 'Unable to save the treatment plan' });
  }
};

exports.updateTreatmentPlan = async (req, res) => {
  const context = doctorContext(req, res);
  if (!context) return;
  const { patientId, planId } = req.params;
  if (!validPatientId(patientId) || !validPatientId(planId)) {
    return res.status(400).json({ error: 'Invalid patient or treatment plan ID' });
  }

  const body = req.body || {};
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (!PLAN_STATUSES.has(body.status)) return res.status(400).json({ error: 'Invalid treatment status' });
    updates.status = body.status;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) {
    if (!PLAN_PRIORITIES.has(body.priority)) return res.status(400).json({ error: 'Invalid treatment priority' });
    updates.priority = body.priority;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 180) {
      return res.status(400).json({ error: 'Invalid treatment title' });
    }
    updates.title = body.title.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    if (typeof body.description !== 'string' || body.description.trim().length > MAX_PLAN_DESCRIPTION) {
      return res.status(400).json({ error: 'Invalid treatment description' });
    }
    updates.description = body.description.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'plannedDate')) {
    const value = body.plannedDate || null;
    if (!validOptionalDate(value)) return res.status(400).json({ error: 'Invalid planned date (YYYY-MM-DD)' });
    updates.plannedDate = value;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid treatment plan updates provided' });

  try {
    if (!await requireClinicPatient(context.doctorId, patientId, res)) return;
    const plan = await TreatmentPlan.findOne({ where: { id: planId, doctorId: context.doctorId, patientId } });
    if (!plan) return res.status(404).json({ error: 'Treatment plan not found for this patient' });
    await plan.update(updates);
    return res.json({ message: 'Treatment plan updated', treatmentPlan: serializeTreatmentPlan(plan) });
  } catch (error) {
    console.error('Update treatment plan error:', error.message);
    return res.status(500).json({ error: 'Unable to update the treatment plan' });
  }
};
