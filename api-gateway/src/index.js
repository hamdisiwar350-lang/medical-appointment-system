const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const verifyToken = require('./middlewares/auth');
const requireRole = require('./middlewares/requireRole');

const app = express();
app.use(helmet());
app.use(cors());
const PORT = process.env.PORT || 8080;

function forwardUser(req, res, next) {
  if (req.user) req.headers['x-user-id'] = req.user.id;
  next();
}

function forwardUserEmail(req, res, next) {
  if (req.user) req.headers['x-user-email'] = req.user.email;
  next();
}

function forwardUserRole(req, res, next) {
  if (req.user) req.headers['x-user-role'] = req.user.role;
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'api-gateway running' });
});

app.use('/auth', createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/auth/' }
}));

app.use(
  '/appointments/:id/status',
  verifyToken,
  requireRole('doctor'),
  forwardUser,
  forwardUserRole,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => `/appointments/${req.params.id}/status`
  })
);

app.use('/doctors', verifyToken, forwardUser, forwardUserRole, (req, res, next) => {
  if (req.method === 'PUT' && req.user.role !== 'doctor') {
    return res.status(403).json({
      error: 'Only doctors can update doctor profiles'
    });
  }
  next();
}, createProxyMiddleware({
  target: process.env.DOCTOR_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/doctors/' }
}));

function authorizeAppointmentRoute(req, res, next) {
  const role = req.user && req.user.role;

  if (!['patient', 'doctor'].includes(role)) {
    return res.status(403).json({ error: 'Access forbidden' });
  }

  if (req.method === 'POST' && role !== 'patient') {
    return res.status(403).json({
      error: 'Only patients can create appointments'
    });
  }

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  next();
}

app.use(
  '/appointments',
  verifyToken,
  authorizeAppointmentRoute,
  forwardUser,
  forwardUserEmail,
  forwardUserRole,
  createProxyMiddleware({
  target: process.env.APPOINTMENT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/appointments/' }
}));

app.use(
  '/notifications',
  verifyToken,
  (req, res, next) => {
    if (!['patient', 'doctor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access forbidden' });
    }

    if (!['GET', 'PUT'].includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    next();
  },
  forwardUserEmail,
  forwardUserRole,
  createProxyMiddleware({
  target: process.env.NOTIFICATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/notifications/' }
}));

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
});
