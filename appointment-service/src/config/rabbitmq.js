const amqp = require('amqplib');

let channel = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectRabbitMQ(retries = 10, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertQueue('appointment_created', { durable: true });
      await channel.assertQueue('appointment_status_updated', { durable: true });
      console.log('✅ RabbitMQ connected');

      connection.on('close', () => {
        console.error('⚠️ RabbitMQ connection closed, retrying...');
        channel = null;
        connectRabbitMQ();
      });

      return;
    } catch (error) {
      console.error(`❌ RabbitMQ connection attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt < retries) await sleep(delayMs);
    }
  }
  console.error('❌ RabbitMQ: all retries exhausted');
}

function publishAppointmentCreated(data) {
  if (!channel) { console.error('⚠️ RabbitMQ channel not ready'); return; }
  channel.sendToQueue('appointment_created', Buffer.from(JSON.stringify(data)), { persistent: true });
}

function publishStatusUpdated(data) {
  if (!channel) { console.error('⚠️ RabbitMQ channel not ready'); return; }
  channel.sendToQueue('appointment_status_updated', Buffer.from(JSON.stringify(data)), { persistent: true });
}

module.exports = { connectRabbitMQ, publishAppointmentCreated, publishStatusUpdated };
