const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    createInternalNotification
} = require('../controllers/notificationController');

// Routes for fetching notification history and marking as read
router.get('/history', getNotifications);
router.patch('/mark-read', markAsRead);

// Internal route for other services to trigger notifications
router.post('/internal/create', createInternalNotification);

module.exports = router;
