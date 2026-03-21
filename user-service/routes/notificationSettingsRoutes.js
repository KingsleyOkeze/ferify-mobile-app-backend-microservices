const express = require("express");
const { getNotificationSettings, updateNotificationSettings } = require("../controllers/notificationSettingsControllers");

const router = express.Router();

router.get('/', getNotificationSettings);
router.patch('/update', updateNotificationSettings);

module.exports = router;
