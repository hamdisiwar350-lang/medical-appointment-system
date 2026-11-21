const express = require('express');
const router = express.Router();
const {
  createAppointment,
  getAllAppointments,
  getAvailability,
  getAppointmentById,
  updateStatus
} = require('../controllers/appointmentController');

router.post('/', createAppointment);
router.get('/availability', getAvailability);
router.get('/', getAllAppointments);
router.get('/:id', getAppointmentById);
router.put('/:id/status', updateStatus);

module.exports = router;
