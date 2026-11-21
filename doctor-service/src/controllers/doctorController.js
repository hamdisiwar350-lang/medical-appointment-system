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
    const doctor = await Doctor.findByPk(req.params.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    await doctor.update(req.body);
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
