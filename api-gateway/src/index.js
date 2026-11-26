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

// Derive clinic scope exclusively from the verified JWT.
function forwardDoctorId(req, res, next) {
  delete req.headers['x-doctor-id'];

  if (req.user?.role === 'doctor') {
    req.headers['x-doctor-id'] = req.user.id;
  } else if (req.user?.role === 'assistant' && req.user.doctorId) {
    req.headers['x-doctor-id'] = req.user.doctorId;
  }

  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'api-gateway running' });
});

// Only authenticated doctors can create assistant accounts.
app.use(
  '/auth/assistants',
  verifyToken,
  requireRole('doctor'),
  forwardUser,
  forwardUserRole,
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/': '/auth/assistants' }
  })
);

app.use('/auth', createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/auth/' }
}));

// Private clinical files are strictly dentist-only. Assistants and patients
// cannot reach these routes, even if they manually call the API.
app.use(
  '/clinical',
  verifyToken,
  requireRole('doctor'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: path => `/clinical${path.startsWith('/') ? path : `/${path}`}`
  })
);

app.use(
  '/appointments/:id/status',
  verifyToken,
  requireRole('doctor', 'assistant'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => `/appointments/${req.params.id}/status`
  })
);

app.use('/doctors', verifyToken, forwardUser, forwardUserRole, (req, res, next) => {
  // Patients and doctors can view doctor profiles.
  if (req.method === 'GET') {
    return next();
  }

  // Only authenticated doctors can update profiles.
  // The Doctor Service verifies that the profile belongs to this doctor.
  if (req.method === 'PUT' && req.user.role === 'doctor') {
    return next();
  }

  // Public profile creation and deletion are disabled.
  return res.status(403).json({
    error: 'This operation is not allowed'
  });
}, createProxyMiddleware({
  target: process.env.DOCTOR_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/doctors/' }
}));


// Reception workflow: limited to administrative appointment data.
app.use(
  '/appointments/waiting-room',
  verifyToken,
  requireRole('doctor', 'assistant'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: () => '/appointments/waiting-room'
  })
);

app.use(
  '/appointments/walk-ins',
  verifyToken,
  requireRole('assistant'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: () => '/appointments/walk-ins'
  })
);

app.use(
  '/appointments/:id/check-in',
  verifyToken,
  requireRole('doctor', 'assistant'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => `/appointments/${req.params.id}/check-in`
  })
);

// Only the dentist may call the next patient or advance the queue to consultation.
app.use(
  '/appointments/:id/queue-status',
  verifyToken,
  requireRole('doctor'),
  forwardUser,
  forwardUserRole,
  forwardDoctorId,
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => `/appointments/${req.params.id}/queue-status`
  })
);

function authorizeAppointmentRoute(req, res, next) {
  const role = req.user && req.user.role;

  if (!['patient', 'doctor', 'assistant'].includes(role)) {
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
  forwardDoctorId,
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
