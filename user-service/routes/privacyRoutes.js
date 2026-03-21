const express = require("express");
const { getPrivacySettings, updatePrivacySettings } = require("../controllers/privacyControllers");

const router = express.Router();

router.get('/', getPrivacySettings);
router.patch('/update', updatePrivacySettings);

module.exports = router;
