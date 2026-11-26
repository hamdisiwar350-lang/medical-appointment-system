const express = require('express');
const sequelize = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const appointmentRoutes = require('./routes/appointments');
const clinicalRoutes = require('./routes/clinical');
// Load clinical models before sequelize.sync so patient files and notes are created.
require('./models/PatientClinicalRecord');
require('./models/ClinicalNote');
require('./models/ClinicalDiagnosis');
require('./models/TreatmentPlan');
require('./models/AppointmentCheckIn');

const app = express();
app.use(require('helmet')());
const PORT = process.env.PORT || 3003;

app.use(express.json({ limit: '64kb' }));
app.use('/appointments', appointmentRoutes);
app.use('/clinical', clinicalRoutes);

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
