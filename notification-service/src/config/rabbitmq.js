const amqp = require('amqplib');
const Notification = require('../models/Notification');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectRabbitMQ(retries = 10, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URL);
      const channel = await connection.createChannel();

      await channel.assertQueue('appointment_created', { durable: true });
      await channel.assertQueue('appointment_status_updated', { durable: true });

      console.log('✅ RabbitMQ connected, listening for appointment events...');

      channel.consume('appointment_created', async (msg) => {
        if (!msg) return;
        try {
          const data = JSON.parse(msg.content.toString());

          await Notification.create({
            appointmentId: data.appointmentId,
            recipientEmail: data.patientEmail,
            type: 'new_appointment_patient',
            data: { doctorName: data.doctorName, appointmentDate: data.appointmentDate },
            status: 'sent'
          });

          if (data.doctorEmail) {
            await Notification.create({
              appointmentId: data.appointmentId,
              recipientEmail: data.doctorEmail,
              type: 'new_appointment_doctor',
              data: { patientName: data.patientName, appointmentDate: data.appointmentDate },
              status: 'sent'
            });
          }

          console.log(`📧 Notifications created for appointment ${data.appointmentId}`);
          channel.ack(msg);
        } catch (err) {
          console.error('❌ Error processing appointment_created:', err.message);
          channel.nack(msg, false, false);
        }
      });

      channel.consume('appointment_status_updated', async (msg) => {
        if (!msg) return;
        try {
          const data = JSON.parse(msg.content.toString());

          await Notification.create({
            appointmentId: data.appointmentId,
            recipientEmail: data.patientEmail,
            type: 'status_update',
            data: { doctorName: data.doctorName, appointmentDate: data.appointmentDate, status: data.status },
            status: 'sent'
          });

          console.log(`📧 Status notification created for appointment ${data.appointmentId}`);
          channel.ack(msg);
        } catch (err) {
          console.error('❌ Error processing appointment_status_updated:', err.message);
          channel.nack(msg, false, false);
        }
      });

      connection.on('close', () => {
        console.error('⚠️ RabbitMQ connection closed, retrying...');
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

module.exports = { connectRabbitMQ };
