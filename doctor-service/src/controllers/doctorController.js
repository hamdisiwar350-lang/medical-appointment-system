const Doctor = require('../models/Doctor');

function clinicDoctorId() {
  return process.env.CLINIC_DOCTOR_ID || null;
}

exports.getClinicDoctor = async (req, res) => {
  try {
    const id = clinicDoctorId();
    if (!id) {
      return res.status(503).json({ error: 'Clinic dentist is not configured' });
    }

    const doctor = await Doctor.findByPk(id);
    if (!doctor) {
      return res.status(404).json({ error: 'Configured clinic dentist profile not found' });
    }

    return res.json(doctor);
  } catch (error) {
    console.error('Get clinic dentist error:', error.message);
    return res.status(500).json({ error: 'Unable to load clinic profile' });
  }
};

exports.getDoctorById = async (req, res) => {
  try {
    const id = clinicDoctorId();
    if (!id || req.params.id !== id) {
      return res.status(404).json({ error: 'Dentist profile not found' });
    }

    const doctor = await Doctor.findByPk(id);
    if (!doctor) return res.status(404).json({ error: 'Dentist profile not found' });
    return res.json(doctor);
  } catch (error) {
    console.error('Get dentist profile error:', error.message);
    return res.status(500).json({ error: 'Unable to load dentist profile' });
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const id = clinicDoctorId();
    const requestingUserId = req.headers['x-user-id'];

    if (!id || req.params.id !== id || requestingUserId !== id) {
      return res.status(403).json({
        error: 'You can only update the configured clinic dentist profile'
      });
    }

    const doctor = await Doctor.findByPk(id);
    if (!doctor) {
      return res.status(404).json({ error: 'Dentist profile not found' });
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

    if (req.body.availableFrom !== undefined) updates.availableFrom = from;
    if (req.body.availableTo !== undefined) updates.availableTo = to;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable fields were provided' });
    }

    await doctor.update(updates);
    return res.json({ message: 'Clinic settings updated successfully', doctor });
  } catch (error) {
    console.error('Update dentist profile error:', error.message);
    return res.status(500).json({ error: 'Unable to update clinic settings' });
  }
};
