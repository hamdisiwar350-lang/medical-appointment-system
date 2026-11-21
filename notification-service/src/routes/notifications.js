const express = require('express');
const router = express.Router();
const {
  getAllNotifications,
  getNotificationById
} = require('../controllers/notificationController');

router.get('/', getAllNotifications);
router.get('/:id', getNotificationById);

module.exports = router;
