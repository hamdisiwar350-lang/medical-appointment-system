const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const verifyToken = require('./middlewares/auth');
const requireRole = require('./middlewares/requireRole');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 8080;

function forwardUser(req, res, next) {
  if (req.user) req.headers['x-user-id'] = req.user.id;
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
  createProxyMiddleware({
    target: process.env.APPOINTMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => `/appointments/${req.params.id}/status`
  })
);

app.use('/doctors', verifyToken, forwardUser, createProxyMiddleware({
  target: process.env.DOCTOR_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/doctors/' }
}));

app.use('/appointments', verifyToken, forwardUser, createProxyMiddleware({
  target: process.env.APPOINTMENT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/appointments/' }
}));

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
});
