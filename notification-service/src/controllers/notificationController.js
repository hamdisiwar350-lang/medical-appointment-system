const Notification = require('../models/Notification');

exports.getAllNotifications = async (req, res) => {
  try {
    const email = req.headers['x-user-email'] || req.query.email;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const notifications = await Notification.findAll({
      where: { recipientEmail: email },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json({ count: notifications.length, notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const email = req.headers['x-user-email'] || req.query.email;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const count = await Notification.count({ where: { recipientEmail: email, read: false } });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    notification.read = true;
    await notification.save();
    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const email = req.headers['x-user-email'] || req.body.email;
    if (!email) return res.status(400).json({ error: 'email is required' });
    await Notification.update({ read: true }, { where: { recipientEmail: email, read: false } });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
