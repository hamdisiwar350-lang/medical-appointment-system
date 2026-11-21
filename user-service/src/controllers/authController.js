const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const validator = require('validator');
const User = require('../models/User');

function validateRegisterInput({ name, email, password, role, specialty }) {
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('الاسم يجب أن يكون أكثر من حرفين');
  if (!email || !validator.isEmail(email)) errors.push('البريد الإلكتروني غير صالح');
  if (!password || password.length < 6) errors.push('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  if (!['patient', 'doctor'].includes(role)) errors.push('الدور غير صالح');
  if (role === 'doctor' && (!specialty || specialty.trim().length < 2)) {
    errors.push('التخصص مطلوب للأطباء');
  }
  return errors;
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, specialty } = req.body;

    const errors = validateRegisterInput({ name, email, password, role, specialty });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role
    });

    if (role === 'doctor') {
      try {
        await axios.post(`${process.env.DOCTOR_SERVICE_URL}/doctors`, {
          id: user.id,
          name: user.name,
          specialty: specialty.trim(),
          email: user.email
        });
      } catch (err) {
        console.error('⚠️ Failed to create doctor profile:', err.message);
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !validator.isEmail(email) || !password) {
      return res.status(400).json({ error: 'Email ou mot de passe manquant/invalide' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
