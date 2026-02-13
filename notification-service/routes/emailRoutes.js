const express = require('express');
const router = express.Router();
const {
    sendVerifySignupEmail,
    sendResetPasswordEmail,
    sendWelcomeEmail,
    sendSetupCompleteEmail,
    sendLoginVerificationEmail,
    sendForgotPasswordEmail,
    sendResendOtpEmail,
} = require('../controllers/emailingControllers');

router.post('/verify-signup', sendVerifySignupEmail);
router.post('/verify-reset', sendResetPasswordEmail);
router.post('/welcome', sendWelcomeEmail);
router.post('/setup-complete', sendSetupCompleteEmail);
router.post('/verify-login', sendLoginVerificationEmail);
router.post('/forgot-password', sendForgotPasswordEmail);
router.post('/resend-otp', sendResendOtpEmail);

module.exports = router;
