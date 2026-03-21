const express = require("express");
const {
    loginInitiateFunction,
    loginVerifyFunction,
    signupStartFunction,
    signupVerifyOtpFunction,
    resendOtpFunction,
    signupCompleteFunction,
    forgotPasswordFunction,
    verifyForgotPasswordOtpFunction,
    resetPasswordFunction,
    refreshTokenFunction,
    logoutFunction
} = require("../controllers/authControllers");
const { googleLoginFunction } = require("../controllers/googleAuthControllers");

const router = express.Router();

router.post('/register/initiate', signupStartFunction);
router.post('/register/verify-otp', signupVerifyOtpFunction);
router.post('/register/complete', signupCompleteFunction);
router.post('/login/initiate', loginInitiateFunction);
router.post('/login/verify', loginVerifyFunction);
router.post('/google-login', googleLoginFunction);


router.get('/register/resend-otp/:email', resendOtpFunction);
router.post('/forgot-password', forgotPasswordFunction);
router.post('/verify-forgot-password-otp', verifyForgotPasswordOtpFunction);
router.post('/reset-password', resetPasswordFunction);
router.post('/refresh-token', refreshTokenFunction);
router.post('/logout', logoutFunction)



module.exports = router;