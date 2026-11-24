const express = require('express');
const router = express.Router();
const {
  getAllNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationById
} = require('../controllers/notificationController');

router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.get('/', getAllNotifications);
router.get('/:id', getNotificationById);
router.put('/:id/read', markAsRead);

module.exports = router;
