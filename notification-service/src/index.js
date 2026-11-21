const express = require('express');
const sequelize = require('./config/database');
const { connectRabbitMQ } = require('./config/rabbitmq');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());
app.use('/notifications', notificationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'notification-service running' });
});

sequelize.sync({ alter: true })
  .then(async () => {
    console.log('✅ Database connected');
    await connectRabbitMQ();
    app.listen(PORT, () => console.log(`🚀 Notification Service running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  });
