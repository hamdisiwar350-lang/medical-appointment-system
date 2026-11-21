const amqp = require('amqplib');

let channel = null;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue('appointment_created', { durable: true });
    console.log('✅ RabbitMQ connected');
  } catch (error) {
    console.error('❌ RabbitMQ connection failed:', error.message);
  }
}

function publishAppointmentCreated(data) {
  if (!channel) {
    console.error('⚠️ RabbitMQ channel not ready, skipping publish');
    return;
  }
  channel.sendToQueue(
    'appointment_created',
    Buffer.from(JSON.stringify(data)),
    { persistent: true }
  );
}

module.exports = { connectRabbitMQ, publishAppointmentCreated };
