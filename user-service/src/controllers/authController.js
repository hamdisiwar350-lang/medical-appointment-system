const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');

function validateRegisterInput({ name, email, password }) {
  const errors = [];

  if (typeof name !== 'string' || name.trim().length < 2) {
    errors.push('الاسم يجب أن يكون أكثر من حرفين');
  }

  if (typeof email !== 'string' || !validator.isEmail(email)) {
    errors.push('البريد الإلكتروني غير صالح');
  }

  if (typeof password !== 'string' || password.length < 6) {
    errors.push('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  }

  return errors;
}

// Public registration: patients only.
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const errors = validateRegisterInput({ name, email, password });

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'patient'
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

// Only an authenticated doctor can create an assistant.
exports.createAssistant = async (req, res) => {
  try {
    const doctorId = req.headers['x-user-id'];
    const requesterRole = req.headers['x-user-role'];

    if (!doctorId || requesterRole !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can create assistant accounts' });
    }

    const { name, email, password } = req.body || {};
    const errors = validateRegisterInput({ name, email, password });

    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const clinicDoctorId = process.env.CLINIC_DOCTOR_ID;
    if (!clinicDoctorId || doctorId !== clinicDoctorId) {
      return res.status(403).json({ error: 'Only the configured clinic dentist can create assistants' });
    }

    const doctor = await User.findByPk(doctorId);

    if (!doctor || doctor.role !== 'doctor') {
      return res.status(403).json({ error: 'Invalid doctor account' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const assistant = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'assistant',
      doctorId: doctor.id
    });

    return res.status(201).json({
      message: 'Assistant account created successfully',
      user: {
        id: assistant.id,
        name: assistant.name,
        email: assistant.email,
        role: assistant.role,
        doctorId: assistant.doctorId
      }
    });
  } catch (error) {
    console.error('Assistant creation error:', error.message);
    return res.status(500).json({ error: 'Assistant creation failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || !validator.isEmail(email) || !password) {
      return res.status(400).json({ error: 'Email ou mot de passe manquant/invalide' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        doctorId: user.doctorId || null
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        doctorId: user.doctorId || null
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'Login failed' });
  }
};
