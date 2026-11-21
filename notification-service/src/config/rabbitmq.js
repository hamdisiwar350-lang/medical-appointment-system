const amqp = require('amqplib');
const Notification = require('../models/Notification');

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue('appointment_created', { durable: true });

    console.log('✅ RabbitMQ connected, listening for appointment_created events...');

    channel.consume('appointment_created', async (msg) => {
      if (msg !== null) {
        try {
          const data = JSON.parse(msg.content.toString());

          const message = `Hello ${data.patientName}, your appointment with ${data.doctorName} on ${data.appointmentDate} has been created.`;

          await Notification.create({
            appointmentId: data.appointmentId,
            recipientEmail: data.patientEmail,
            message,
            status: 'sent'
          });

          console.log(`📧 Notification created for ${data.patientEmail}`);
          channel.ack(msg);
        } catch (err) {
          console.error('❌ Error processing message:', err.message);
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (error) {
    console.error('❌ RabbitMQ connection failed:', error.message);
  }
}

module.exports = { connectRabbitMQ };
