const express = require("express");
const {
    initiateEmailUpdate,
    verifyEmailUpdate,
    updateUsername,
    initiatePasswordReset,
    verifyPasswordReset
} = require("../controllers/accountControllers");

const router = express.Router();

router.post('/update-email/initiate', initiateEmailUpdate);
router.post('/update-email/verify', verifyEmailUpdate);
router.put('/update-username', updateUsername);
router.post('/reset-password/initiate', initiatePasswordReset);
router.post('/reset-password/verify', verifyPasswordReset);

module.exports = router;
