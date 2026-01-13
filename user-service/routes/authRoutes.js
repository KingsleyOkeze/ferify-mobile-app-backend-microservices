const express = require("express");
const {
    loginFunction,
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

const router = express.Router();

router.post('/register/start', signupStartFunction);
router.post('/register/verify-otp', signupVerifyOtpFunction);
router.post('/register/complete', signupCompleteFunction);
router.post('/login', loginFunction);


router.post('/register/resend-otp', resendOtpFunction);
router.post('/register/forgot-password', forgotPasswordFunction);
router.post('/register/verify-forgot-password-otp', verifyForgotPasswordOtpFunction);
router.post('/register/reset-password', resetPasswordFunction);
router.post('/register/refreshToken', refreshTokenFunction);
router.get('/register/logout', logoutFunction)



module.exports = router;