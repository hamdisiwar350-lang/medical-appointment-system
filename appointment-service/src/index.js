const express = require('express');
const sequelize = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const appointmentRoutes = require('./routes/appointments');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());
app.use('/appointments', appointmentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'appointment-service running' });
});

sequelize.sync({ alter: true })
  .then(async () => {
    console.log('✅ Database connected');
    await connectRabbitMQ();
    app.listen(PORT, () => console.log(`🚀 Appointment Service running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  });
