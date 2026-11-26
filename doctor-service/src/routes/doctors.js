const express = require('express');
const router = express.Router();
const {
  getClinicDoctor,
  getDoctorById,
  updateDoctor
} = require('../controllers/doctorController');

// One clinic and one dentist: there is no public doctor directory.
router.get('/clinic', getClinicDoctor);
router.get('/:id', getDoctorById);
router.put('/:id', updateDoctor);

module.exports = router;
