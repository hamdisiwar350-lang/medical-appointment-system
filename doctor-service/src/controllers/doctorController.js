const Doctor = require('../models/Doctor');
const { Op } = require('sequelize');

exports.createDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);
    res.status(201).json({ message: 'Doctor created successfully', doctor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllDoctors = async (req, res) => {
  try {
    const { specialty } = req.query;
    const where = specialty ? { specialty: { [Op.iLike]: `%${specialty}%` } } : {};
    const doctors = await Doctor.findAll({ where });
    res.json({ count: doctors.length, doctors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'];

    if (!requestingUserId || requestingUserId !== req.params.id) {
      return res.status(403).json({
        error: 'You can only update your own doctor profile'
      });
    }

    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
      const phone = String(req.body.phone || '').trim();

      if (phone.length > 30) {
        return res.status(400).json({ error: 'Phone number is too long' });
      }

      updates.phone = phone || null;
    }

    const from = req.body.availableFrom ?? doctor.availableFrom;
    const to = req.body.availableTo ?? doctor.availableTo;
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (!timePattern.test(from) || !timePattern.test(to) || from >= to) {
      return res.status(400).json({
        error: 'Working hours must be valid HH:MM values and end after start'
      });
    }

    if (req.body.availableFrom !== undefined) {
      updates.availableFrom = from;
    }

    if (req.body.availableTo !== undefined) {
      updates.availableTo = to;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No editable fields were provided'
      });
    }

    await doctor.update(updates);
    res.json({ message: 'Doctor updated successfully', doctor });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    await doctor.destroy();
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSpecialties = async (req, res) => {
  try {
    const doctors = await Doctor.findAll({ attributes: ['specialty'] });
    const specialties = [...new Set(doctors.map(d => d.specialty))];
    res.json({ specialties });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
