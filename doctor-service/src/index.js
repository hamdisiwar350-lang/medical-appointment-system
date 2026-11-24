const express = require('express');
const sequelize = require('./config/database');
const doctorRoutes = require('./routes/doctors');

const app = express();
app.use(require('helmet')());
const PORT = process.env.PORT || 3002;

app.use(express.json({ limit: '10kb' }));
app.use('/doctors', doctorRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'doctor-service running' });
});

sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ Database connected');
    app.listen(PORT, () => console.log(`🚀 Doctor Service running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  });
