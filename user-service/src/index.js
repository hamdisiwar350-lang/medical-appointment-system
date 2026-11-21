const express = require('express');
const sequelize = require('./config/database');
const authRoutes = require('./routes/auth');
const { loginLimiter } = require('./middlewares/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use('/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'user-service is running' });
});

sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ Database connected');
    app.listen(PORT, () => console.log(`🚀 User Service running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  });
