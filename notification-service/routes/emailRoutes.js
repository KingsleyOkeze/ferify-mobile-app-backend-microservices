const express = require("express");
const {sendOtpEmailFunction} = require("../controllers/emailingControllers");

const router = express.Router();

router.get('/send-otp-email', sendOtpEmailFunction);


module.exports = router;