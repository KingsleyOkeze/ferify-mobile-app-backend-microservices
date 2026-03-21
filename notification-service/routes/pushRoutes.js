const express = require('express');
const router = express.Router();
const { sendPushNotification } = require('../controllers/pushControllers');

router.post('/send', sendPushNotification);

module.exports = router;
