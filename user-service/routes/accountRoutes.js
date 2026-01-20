const express = require("express");
const {
    verifyEmailUpdate,
    updateUsername,
    verifyPasswordReset,
    updateProfilePhoto,
    updateProfilePhoto,
    updateProfile,
    updateUserLocation
} = require("../controllers/accountControllers");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post('/update-email/verify', verifyEmailUpdate);
router.put('/update-username', updateUsername);
router.post('/reset-password/verify', verifyPasswordReset);
router.put('/update-profile-photo', upload.single('profilePhoto'), updateProfilePhoto);
router.put('/update-profile', updateProfile);
router.patch('/location', updateUserLocation);

module.exports = router;
