const axios = require('axios');
const { Op } = require('sequelize');
const Appointment = require('../models/Appointment');
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
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ error: 'doctorId and date are required' });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return res.json({ date, doctorId, slots: [], message: 'لا يمكن الحجز في تاريخ قد مضى' });
    }

    let doctor;
    try {
      const response = await axios.get(`${process.env.DOCTOR_SERVICE_URL}/doctors/${doctorId}`);
      doctor = response.data;
    } catch (err) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const allSlots = generateSlots(doctor.availableFrom, doctor.availableTo);
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const existing = await Appointment.findAll({
      where: {
        doctorId,
        appointmentDate: { [Op.between]: [dayStart, dayEnd] },
        status: { [Op.ne]: 'cancelled' }
      }
    });

    const bookedTimes = new Set(existing.map(a => {
      const d = new Date(a.appointmentDate);
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    }));

    const now = new Date();
    const isToday = date === now.toISOString().slice(0, 10);
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    const availableSlots = allSlots.filter(slot => {
      if (bookedTimes.has(slot)) return false;
      if (isToday) {
        const [h, m] = slot.split(':').map(Number);
        if (h * 60 + m <= nowMinutes) return false;
      }
      return true;
    });

    res.json({ date, doctorId, slots: availableSlots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const { patientId, patientName, patientEmail, doctorId, appointmentDate, notes } = req.body;

    let doctor;
    try {
      const response = await axios.get(`${process.env.DOCTOR_SERVICE_URL}/doctors/${doctorId}`);
      doctor = response.data;
    } catch (err) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const requestedDate = new Date(appointmentDate);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid appointment date' });
    }
    if (requestedDate < new Date()) {
      return res.status(400).json({ error: 'Cannot book an appointment in the past' });
    }

    let appointment;
    try {
      appointment = await Appointment.create({
        patientId, patientName, patientEmail, doctorId,
        doctorName: doctor.name, appointmentDate, notes
      });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'This time slot is no longer available' });
      }
      throw err;
    }

    publishAppointmentCreated({
      appointmentId: appointment.id,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      doctorName: appointment.doctorName,
      doctorEmail: doctor.email,
      appointmentDate: appointment.appointmentDate
    });

    res.status(201).json({ message: 'Appointment created successfully', appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllAppointments = async (req, res) => {
  try {
    const { doctorId, patientId } = req.query;
    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;

    const appointments = await Appointment.findAll({ where, order: [['appointmentDate', 'ASC']] });
    res.json({ count: appointments.length, appointments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const requestingDoctorId = req.headers['x-user-id'];
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    if (requestingDoctorId && appointment.doctorId !== requestingDoctorId) {
      return res.status(403).json({ error: 'You can only update your own appointments' });
    }

    appointment.status = status;
    await appointment.save();

    publishStatusUpdated({
      appointmentId: appointment.id,
      patientEmail: appointment.patientEmail,
      doctorName: appointment.doctorName,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status
    });

    res.json({ message: 'Status updated successfully', appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
