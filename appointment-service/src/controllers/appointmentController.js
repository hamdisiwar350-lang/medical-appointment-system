const axios = require('axios');
const { Op } = require('sequelize');
const Appointment = require('../models/Appointment');
const AppointmentCheckIn = require('../models/AppointmentCheckIn');
const receptionSequelize = require('../config/database');
const { Op: ReceptionOp } = require('sequelize');
const { randomUUID: createReceptionUUID } = require('crypto');
const { canUpdateQueueStatus } = require('../utils/queueTransitions');
const { publishAppointmentCreated, publishStatusUpdated } = require('../config/rabbitmq');

const SLOT_DURATION_MINUTES = 30;

function generateSlots(availableFrom, availableTo, duration = SLOT_DURATION_MINUTES) {
  const [fh, fm] = availableFrom.split(':').map(Number);
  const [th, tm] = availableTo.split(':').map(Number);
  const start = fh * 60 + fm;
  const end = th * 60 + tm;
  const slots = [];
  for (let t = start; t + duration <= end; t += duration) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

exports.getAvailability = async (req, res) => {
  try {
    const doctorId = process.env.CLINIC_DOCTOR_ID;
    const { date } = req.query;
    const timezoneOffset = Number.parseInt(req.query.timezoneOffset || '0', 10);

    if (!doctorId) {
      return res.status(503).json({ error: 'Clinic dentist is not configured' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'A valid date is required (YYYY-MM-DD)' });
    }

    if (!Number.isInteger(timezoneOffset) || timezoneOffset < -840 || timezoneOffset > 840) {
      return res.status(400).json({ error: 'Invalid timezone offset' });
    }

    const [year, month, day] = date.split('-').map(Number);
    const localDayStart = Date.UTC(year, month - 1, day);
    const dayStart = new Date(localDayStart + timezoneOffset * 60000);
    const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);

    const nowAsLocal = new Date(Date.now() - timezoneOffset * 60000);
    const today = nowAsLocal.toISOString().slice(0, 10);
    if (date < today) {
      return res.json({ date, slots: [], message: 'لا يمكن الحجز في تاريخ قد مضى' });
    }

    let doctor;
    try {
      const response = await axios.get(
        `${process.env.DOCTOR_SERVICE_URL}/doctors/${encodeURIComponent(doctorId)}`
      );
      doctor = response.data;
    } catch (error) {
      return res.status(503).json({ error: 'Clinic dentist profile is unavailable' });
    }

    const allSlots = generateSlots(doctor.availableFrom, doctor.availableTo);
    const existing = await Appointment.findAll({
      where: {
        doctorId,
        appointmentDate: { [Op.between]: [dayStart, dayEnd] },
        status: { [Op.ne]: 'cancelled' }
      },
      attributes: ['appointmentDate']
    });

    const bookedTimes = new Set(existing.map(appointment => {
      const localDate = new Date(new Date(appointment.appointmentDate).getTime() - timezoneOffset * 60000);
      return `${String(localDate.getUTCHours()).padStart(2, '0')}:${String(localDate.getUTCMinutes()).padStart(2, '0')}`;
    }));

    const isToday = date === today;
    const nowMinutes = nowAsLocal.getUTCHours() * 60 + nowAsLocal.getUTCMinutes();

    const availableSlots = allSlots.filter(slot => {
      if (bookedTimes.has(slot)) return false;
      if (isToday) {
        const [hour, minute] = slot.split(':').map(Number);
        if (hour * 60 + minute <= nowMinutes) return false;
      }
      return true;
    });

    return res.json({ date, slots: availableSlots });
  } catch (error) {
    console.error('Availability error:', error.message);
    return res.status(500).json({ error: 'Unable to load available times' });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const patientId = req.headers['x-user-id'];
    const patientEmail = req.headers['x-user-email'];
    const role = req.headers['x-user-role'];
    const doctorId = process.env.CLINIC_DOCTOR_ID;

    if (role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can create appointments' });
    }

    if (!patientId || !patientEmail) {
      return res.status(401).json({ error: 'Authenticated patient required' });
    }

    if (!doctorId) {
      return res.status(503).json({ error: 'Clinic dentist is not configured' });
    }

    const { patientName, appointmentDate, notes } = req.body || {};
    if (typeof patientName !== 'string' || patientName.trim().length < 2 || !appointmentDate) {
      return res.status(400).json({ error: 'patientName and appointmentDate are required' });
    }

    if (typeof notes === 'string' && notes.length > 2000) {
      return res.status(400).json({ error: 'Appointment note is too long' });
    }

    let doctor;
    try {
      const response = await axios.get(
        `${process.env.DOCTOR_SERVICE_URL}/doctors/${encodeURIComponent(doctorId)}`
      );
      doctor = response.data;
    } catch (error) {
      return res.status(503).json({ error: 'Clinic dentist profile is unavailable' });
    }

    const requestedDate = new Date(appointmentDate);
    if (Number.isNaN(requestedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid appointment date' });
    }

    if (requestedDate < new Date()) {
      return res.status(400).json({ error: 'Cannot book an appointment in the past' });
    }

    let appointment;
    try {
      appointment = await Appointment.create({
        patientId,
        patientName: patientName.trim(),
        patientEmail,
        doctorId,
        doctorName: doctor.name,
        appointmentDate: requestedDate,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'This time slot is no longer available' });
      }
      throw error;
    }

    publishAppointmentCreated({
      appointmentId: appointment.id,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      doctorName: appointment.doctorName,
      doctorEmail: doctor.email,
      appointmentDate: appointment.appointmentDate
    });

    return res.status(201).json({
      message: 'Appointment created successfully',
      appointment
    });
  } catch (error) {
    console.error('Create appointment error:', error.message);
    return res.status(500).json({ error: 'Unable to create appointment' });
  }
};

// Assistant responses contain administrative appointment data only.
// Clinical notes must never be exposed through assistant endpoints.
function assistantAppointmentView(appointment) {
  return {
    id: appointment.id,
    patientName: appointment.patientName,
    patientEmail: appointment.patientEmail,
    doctorName: appointment.doctorName,
    appointmentDate: appointment.appointmentDate,
    status: appointment.status,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt
  };
}

exports.getAllAppointments = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const where = {};

    const clinicDoctorId = process.env.CLINIC_DOCTOR_ID;
    if (!clinicDoctorId) {
      return res.status(503).json({ error: 'Clinic dentist is not configured' });
    }

    if (role === 'patient') {
      where.patientId = userId;
      where.doctorId = clinicDoctorId;
    } else if (role === 'doctor') {
      if (userId !== clinicDoctorId) {
        return res.status(403).json({ error: 'This account is not the configured clinic dentist' });
      }
      where.doctorId = clinicDoctorId;
    } else if (role === 'assistant') {
      const doctorId = req.headers['x-doctor-id'];

      if (!doctorId || doctorId !== clinicDoctorId) {
        return res.status(403).json({
          error: 'Assistant is not linked to this clinic dentist'
        });
      }

      where.doctorId = clinicDoctorId;
    } else {
      return res.status(403).json({ error: 'Access forbidden' });
    }

    const appointments = await Appointment.findAll({
      where,
      order: [['appointmentDate', 'ASC']]
    });

    const result = role === 'assistant'
      ? appointments.map(assistantAppointmentView)
      : appointments;

    return res.json({
      count: result.length,
      appointments: result
    });
  } catch (error) {
    console.error('Get appointments error:', error.message);
    return res.status(500).json({
      error: 'Unable to retrieve appointments'
    });
  }
};

exports.getAppointmentById = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const appointment = await Appointment.findByPk(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const clinicDoctorId = process.env.CLINIC_DOCTOR_ID;
    let isOwner = false;

    if (!clinicDoctorId) {
      return res.status(503).json({ error: 'Clinic dentist is not configured' });
    }

    if (role === 'patient') {
      isOwner = appointment.patientId === userId && appointment.doctorId === clinicDoctorId;
    } else if (role === 'doctor') {
      isOwner = userId === clinicDoctorId && appointment.doctorId === clinicDoctorId;
    } else if (role === 'assistant') {
      const doctorId = req.headers['x-doctor-id'];
      isOwner = doctorId === clinicDoctorId && appointment.doctorId === clinicDoctorId;
    }

    if (!isOwner) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (role === 'assistant') {
      return res.json(assistantAppointmentView(appointment));
    }

    return res.json(appointment);
  } catch (error) {
    console.error('Get appointment error:', error.message);
    return res.status(500).json({
      error: 'Unable to retrieve appointment'
    });
  }
};

// Assistant reception workflow. This API returns administrative fields only.

function clinicReceptionContext(req, res, roles) {
  const userId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  const clinicDoctorId = process.env.CLINIC_DOCTOR_ID;

  if (!userId || !roles.includes(role)) {
    res.status(403).json({ error: 'Access forbidden' });
    return null;
  }
  if (!clinicDoctorId) {
    res.status(503).json({ error: 'Clinic dentist is not configured' });
    return null;
  }

  const doctorId = role === 'doctor' ? userId : req.headers['x-doctor-id'];
  if (doctorId !== clinicDoctorId) {
    res.status(403).json({ error: 'User is not linked to this clinic dentist' });
    return null;
  }
  return { userId, role, doctorId };
}

function receptionAppointmentView(appointment, checkIn = null) {
  return {
    id: appointment.id,
    patientName: appointment.patientName,
    patientEmail: appointment.patientEmail,
    doctorName: appointment.doctorName,
    appointmentDate: appointment.appointmentDate,
    status: appointment.status,
    checkIn: checkIn ? {
      arrivedAt: checkIn.arrivedAt,
      queueStatus: checkIn.status,
      source: checkIn.source
    } : null
  };
}

exports.getWaitingRoom = async (req, res) => {
  const context = clinicReceptionContext(req, res, ['assistant', 'doctor']);
  if (!context) return;

  try {
    const entries = await AppointmentCheckIn.findAll({
      where: {
        doctorId: context.doctorId,
        status: { [ReceptionOp.in]: ['waiting', 'called', 'in_consultation'] }
      },
      order: [['arrivedAt', 'ASC']]
    });

    const appointments = await Promise.all(entries.map(entry =>
      Appointment.findOne({ where: { id: entry.appointmentId, doctorId: context.doctorId } })
    ));

    const queue = entries.reduce((result, entry, index) => {
      const appointment = appointments[index];
      if (appointment) {
        result.push({
          ...receptionAppointmentView(appointment, entry),
          arrivedAt: entry.arrivedAt,
          queueStatus: entry.status,
          source: entry.source
        });
      }
      return result;
    }, []);

    return res.json({ count: queue.length, queue });
  } catch (error) {
    console.error('Get waiting room error:', error.message);
    return res.status(500).json({ error: 'Unable to retrieve the waiting room' });
  }
};

exports.checkInAppointment = async (req, res) => {
  const context = clinicReceptionContext(req, res, ['assistant', 'doctor']);
  if (!context) return;

  try {
    const appointment = await Appointment.findOne({
      where: { id: req.params.id, doctorId: context.doctorId }
    });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (appointment.status !== 'confirmed') {
      return res.status(409).json({ error: 'Confirm the appointment before check-in' });
    }

    const [entry, created] = await AppointmentCheckIn.findOrCreate({
      where: { appointmentId: appointment.id },
      defaults: {
        appointmentId: appointment.id,
        doctorId: context.doctorId,
        patientId: appointment.patientId,
        checkedInBy: context.userId,
        arrivedAt: new Date(),
        status: 'waiting',
        source: 'appointment'
      }
    });

    return res.status(created ? 201 : 200).json({
      message: created ? 'Patient checked in' : 'Patient was already checked in',
      appointment: receptionAppointmentView(appointment, entry)
    });
  } catch (error) {
    console.error('Appointment check-in error:', error.message);
    return res.status(500).json({ error: 'Unable to check in this patient' });
  }
};

exports.createWalkIn = async (req, res) => {
  const context = clinicReceptionContext(req, res, ['assistant']);
  if (!context) return;

  const patientName = typeof req.body?.patientName === 'string' ? req.body.patientName.trim() : '';
  const patientEmail = typeof req.body?.patientEmail === 'string' ? req.body.patientEmail.trim().toLowerCase() : '';
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!patientName || patientName.length > 255) {
    return res.status(400).json({ error: 'Patient name is required (maximum 255 characters)' });
  }
  if (!emailPattern.test(patientEmail) || patientEmail.length > 255) {
    return res.status(400).json({ error: 'A valid patient email is required' });
  }

  try {
    // Reuse the existing patientId when this email already has a clinic appointment.
    const previousAppointment = await Appointment.findOne({
      where: { doctorId: context.doctorId, patientEmail },
      order: [['appointmentDate', 'DESC']]
    });
    const patientId = previousAppointment ? previousAppointment.patientId : createReceptionUUID();
    const doctorName = process.env.CLINIC_DOCTOR_NAME || previousAppointment?.doctorName || 'Dentiste du cabinet';
    const now = new Date();

    const result = await receptionSequelize.transaction(async transaction => {
      const appointment = await Appointment.create({
        patientId,
        patientName,
        patientEmail,
        doctorId: context.doctorId,
        doctorName,
        appointmentDate: now,
        status: 'confirmed',
        notes: null
      }, { transaction });

      const checkIn = await AppointmentCheckIn.create({
        appointmentId: appointment.id,
        doctorId: context.doctorId,
        patientId,
        checkedInBy: context.userId,
        arrivedAt: now,
        status: 'waiting',
        source: 'walk_in'
      }, { transaction });

      return { appointment, checkIn };
    });

    return res.status(201).json({
      message: 'Walk-in patient added to the waiting room',
      appointment: receptionAppointmentView(result.appointment, result.checkIn)
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A conflicting appointment already exists for this time' });
    }
    console.error('Create walk-in error:', error.message);
    return res.status(500).json({ error: 'Unable to add this walk-in patient' });
  }
};

// Only the dentist may call the next patient or advance consultation queue state.
exports.updateQueueStatus = async (req, res) => {
  const context = clinicReceptionContext(req, res, ['doctor']);
  if (!context) return;

  const nextStatus = req.body?.status;
  if (!['called', 'in_consultation', 'completed', 'left'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid queue status' });
  }

  try {
    const entry = await AppointmentCheckIn.findOne({
      where: { appointmentId: req.params.id, doctorId: context.doctorId }
    });
    if (!entry) return res.status(404).json({ error: 'Waiting-room entry not found' });
    if (!canUpdateQueueStatus(context.role, entry.status, nextStatus)) {
      return res.status(400).json({ error: 'Invalid queue status transition' });
    }

    const now = new Date();
    const updates = { status: nextStatus };
    if (nextStatus === 'called') updates.calledAt = now;
    if (nextStatus === 'in_consultation') updates.startedAt = now;
    if (nextStatus === 'completed') updates.completedAt = now;
    await entry.update(updates);

    if (nextStatus === 'completed') {
      const appointment = await Appointment.findOne({
        where: { id: entry.appointmentId, doctorId: context.doctorId }
      });
      if (appointment && appointment.status === 'confirmed') {
        appointment.status = 'completed';
        await appointment.save();
        publishStatusUpdated({
          appointmentId: appointment.id,
          patientEmail: appointment.patientEmail,
          doctorName: appointment.doctorName,
          appointmentDate: appointment.appointmentDate,
          status: appointment.status
        });
      }
    }

    return res.json({
      message: 'Waiting-room status updated',
      queueEntry: {
        appointmentId: entry.appointmentId,
        status: entry.status,
        arrivedAt: entry.arrivedAt,
        calledAt: entry.calledAt,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt
      }
    });
  } catch (error) {
    console.error('Update queue status error:', error.message);
    return res.status(500).json({ error: 'Unable to update waiting-room status' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];

    if (!requestingUserId || !['doctor', 'assistant'].includes(role)) {
      return res.status(403).json({
        error: 'Only doctors and assistants can update appointment status'
      });
    }

    const clinicDoctorId = process.env.CLINIC_DOCTOR_ID;
    const doctorId = role === 'doctor'
      ? requestingUserId
      : req.headers['x-doctor-id'];

    if (!clinicDoctorId) {
      return res.status(503).json({ error: 'Clinic dentist is not configured' });
    }

    if (doctorId !== clinicDoctorId) {
      return res.status(403).json({
        error: 'User is not linked to this clinic dentist'
      });
    }

    const { status } = req.body || {};
    const appointment = await Appointment.findByPk(req.params.id);

    if (!appointment || appointment.doctorId !== doctorId) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // The assistant can confirm or cancel, but cannot complete consultations.
    const transitions = role === 'assistant'
      ? {
          pending: ['confirmed', 'cancelled'],
          confirmed: ['cancelled'],
          cancelled: [],
          completed: []
        }
      : {
          pending: ['confirmed', 'cancelled'],
          confirmed: ['completed', 'cancelled'],
          cancelled: [],
          completed: []
        };

    if (role === 'assistant' && status === 'cancelled') {
      const activeCheckIn = await AppointmentCheckIn.findOne({
        where: {
          appointmentId: appointment.id,
          status: { [ReceptionOp.in]: ['waiting', 'called', 'in_consultation'] }
        }
      });
      if (activeCheckIn) {
        return res.status(409).json({ error: 'This patient has already checked in; ask the dentist before cancelling' });
      }
    }

    const allowedNextStatuses = transitions[appointment.status] || [];

    if (!allowedNextStatuses.includes(status)) {
      if (role === 'assistant' && status === 'completed') {
        return res.status(403).json({
          error: 'Only the doctor can complete a consultation'
        });
      }

      return res.status(400).json({
        error: 'Invalid appointment status transition'
      });
    }

    appointment.status = status;
    await appointment.save();

    if (status === 'cancelled' && role === 'doctor') {
      const activeCheckIn = await AppointmentCheckIn.findOne({
        where: {
          appointmentId: appointment.id,
          status: { [ReceptionOp.in]: ['waiting', 'called'] }
        }
      });
      if (activeCheckIn) await activeCheckIn.update({ status: 'left' });
    }

    publishStatusUpdated({
      appointmentId: appointment.id,
      patientEmail: appointment.patientEmail,
      doctorName: appointment.doctorName,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status
    });

    const result = role === 'assistant'
      ? assistantAppointmentView(appointment)
      : appointment;

    return res.json({
      message: 'Status updated successfully',
      appointment: result
    });
  } catch (error) {
    console.error('Update appointment status error:', error.message);
    return res.status(500).json({
      error: 'Unable to update appointment status'
    });
  }
};
