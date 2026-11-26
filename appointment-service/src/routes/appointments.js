const express = require('express');
const router = express.Router();
const {
  createAppointment,
  getAllAppointments,
  getAvailability,
  getAppointmentById,
  updateStatus,
  getWaitingRoom,
  checkInAppointment,
  createWalkIn,
  updateQueueStatus
} = require('../controllers/appointmentController');

router.post('/', createAppointment);
router.get('/availability', getAvailability);
router.get('/', getAllAppointments);
router.get('/waiting-room', getWaitingRoom);
router.post('/walk-ins', createWalkIn);
router.post('/:id/check-in', checkInAppointment);
router.put('/:id/queue-status', updateQueueStatus);
router.get('/:id', getAppointmentById);
router.put('/:id/status', updateStatus);

module.exports = router;
