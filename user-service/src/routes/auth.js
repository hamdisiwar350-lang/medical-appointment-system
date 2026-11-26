const express = require('express');
const router = express.Router();
const {
  register,
  login,
  createAssistant
} = require('../controllers/authController');
const { loginLimiter } = require('../middlewares/rateLimiter');

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/assistants', createAssistant);

module.exports = router;
