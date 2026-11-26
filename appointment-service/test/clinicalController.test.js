const test = require('node:test');
const assert = require('node:assert/strict');

const ids = {
  doctor: '81e32a04-eecb-4daf-85bc-611313b885e8',
  patient: 'b9d6d9b2-3c13-4a4f-bd9f-69a8a1f7b3a1',
  diagnosis: 'a6f1e9c0-93d6-4f43-97e2-1c2b3a4d5e6f',
  plan: 'c7f1e9c0-93d6-4f43-97e2-1c2b3a4d5e6f'
};

const mocks = {
  Appointment: { findAll: async () => [{ id: 'appointment-1' }] },
  PatientClinicalRecord: { findOrCreate: async () => [{ id: 'record-1', odontogram: {} }] },
  ClinicalNote: { findAll: async () => [], create: async values => ({ id: 'note-1', ...values, createdAt: new Date('2026-11-26T10:00:00Z') }) },
  ClinicalDiagnosis: {
    findAll: async () => [],
    findOne: async () => null,
    create: async values => ({ id: ids.diagnosis, ...values, createdAt: new Date('2026-11-26T10:00:00Z'), updatedAt: new Date('2026-11-26T10:00:00Z') })
  },
  TreatmentPlan: {
    findAll: async () => [],
    findOne: async () => null,
    create: async values => ({ id: ids.plan, ...values, createdAt: new Date('2026-11-26T10:00:00Z'), updatedAt: new Date('2026-11-26T10:00:00Z') })
  }
};

function installMock(relativePath, exports) {
  const filename = require.resolve(relativePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports, children: [], paths: [] };
}

installMock('../src/models/Appointment', mocks.Appointment);
installMock('../src/models/PatientClinicalRecord', mocks.PatientClinicalRecord);
installMock('../src/models/ClinicalNote', mocks.ClinicalNote);
installMock('../src/models/ClinicalDiagnosis', mocks.ClinicalDiagnosis);
installMock('../src/models/TreatmentPlan', mocks.TreatmentPlan);

const controllerPath = require.resolve('../src/controllers/clinicalController');
delete require.cache[controllerPath];
const controller = require('../src/controllers/clinicalController');

function makeRequest({ role = 'doctor', userId = ids.doctor, params = {}, body = {} } = {}) {
  return { headers: { 'x-user-id': userId, 'x-user-role': role }, params, body };
}

function makeResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

function setDefaultMocks() {
  mocks.Appointment.findAll = async () => [{ id: 'appointment-1' }];
  mocks.ClinicalDiagnosis.findAll = async () => [];
  mocks.ClinicalDiagnosis.findOne = async () => null;
  mocks.ClinicalDiagnosis.create = async values => ({ id: ids.diagnosis, ...values, createdAt: new Date(), updatedAt: new Date() });
  mocks.TreatmentPlan.findAll = async () => [];
  mocks.TreatmentPlan.findOne = async () => null;
  mocks.TreatmentPlan.create = async values => ({ id: ids.plan, ...values, createdAt: new Date(), updatedAt: new Date() });
  process.env.CLINIC_DOCTOR_ID = ids.doctor;
}

test.beforeEach(setDefaultMocks);

test('clinical diagnosis API rejects assistant role', async () => {
  const req = makeRequest({ role: 'assistant', params: { patientId: ids.patient }, body: { diagnosis: 'Carie' } });
  const res = makeResponse();
  await controller.createDiagnosis(req, res);
  assert.equal(res.statusCode, 403);
});

test('odontogram endpoint rejects malformed FDI tooth numbers', async () => {
  const req = makeRequest({ params: { patientId: ids.patient, toothNumber: '24abc' }, body: { status: 'caries' } });
  const res = makeResponse();
  await controller.updateToothFinding(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /FDI/);
});

test('diagnosis is stored against the real clinic patient and dentist', async () => {
  let saved;
  mocks.ClinicalDiagnosis.create = async values => {
    saved = values;
    return { id: ids.diagnosis, ...values, createdAt: new Date(), updatedAt: new Date() };
  };
  const req = makeRequest({
    params: { patientId: ids.patient },
    body: { diagnosis: 'Carie dentaire', toothNumber: 24, details: 'Observation clinique', status: 'active' }
  });
  const res = makeResponse();
  await controller.createDiagnosis(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(saved.doctorId, ids.doctor);
  assert.equal(saved.patientId, ids.patient);
  assert.equal(saved.toothNumber, 24);
  assert.equal(res.payload.diagnosis.id, ids.diagnosis);
});

test('treatment plan cannot be linked to another patient diagnosis', async () => {
  mocks.ClinicalDiagnosis.findOne = async () => null;
  const req = makeRequest({
    params: { patientId: ids.patient },
    body: { title: 'Soin dentaire', diagnosisId: ids.diagnosis }
  });
  const res = makeResponse();
  await controller.createTreatmentPlan(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /does not belong/);
});

test('treatment plan is created with initial proposed status', async () => {
  let saved;
  mocks.TreatmentPlan.create = async values => {
    saved = values;
    return { id: ids.plan, ...values, createdAt: new Date(), updatedAt: new Date() };
  };
  const req = makeRequest({
    params: { patientId: ids.patient },
    body: { title: 'Soin de la dent 24', description: 'Séance clinique', priority: 'high', plannedDate: '2026-12-05' }
  });
  const res = makeResponse();
  await controller.createTreatmentPlan(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(saved.status, 'proposed');
  assert.equal(saved.patientId, ids.patient);
  assert.equal(saved.plannedDate, '2026-12-05');
});

test('treatment plan status update is scoped to the same dentist and patient', async () => {
  let lookup;
  const plan = { update: async updates => Object.assign(plan, updates), id: ids.plan, title: 'Soin' };
  mocks.TreatmentPlan.findOne = async options => { lookup = options.where; return plan; };
  const req = makeRequest({
    params: { patientId: ids.patient, planId: ids.plan },
    body: { status: 'in_progress' }
  });
  const res = makeResponse();
  await controller.updateTreatmentPlan(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(lookup, { id: ids.plan, doctorId: ids.doctor, patientId: ids.patient });
  assert.equal(res.payload.treatmentPlan.status, 'in_progress');
});
