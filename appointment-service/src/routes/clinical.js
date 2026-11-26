const express = require('express');
const router = express.Router();
const {
  getPatients,
  getPatientRecord,
  updatePatientRecord,
  createClinicalNote,
  updateToothFinding,
  createDiagnosis,
  updateDiagnosis,
  createTreatmentPlan,
  updateTreatmentPlan
} = require('../controllers/clinicalController');

router.get('/patients', getPatients);
router.get('/patients/:patientId', getPatientRecord);
router.put('/patients/:patientId', updatePatientRecord);
router.post('/patients/:patientId/notes', createClinicalNote);
router.put('/patients/:patientId/teeth/:toothNumber', updateToothFinding);
router.post('/patients/:patientId/diagnoses', createDiagnosis);
router.put('/patients/:patientId/diagnoses/:diagnosisId', updateDiagnosis);
router.post('/patients/:patientId/treatment-plans', createTreatmentPlan);
router.put('/patients/:patientId/treatment-plans/:planId', updateTreatmentPlan);

module.exports = router;
