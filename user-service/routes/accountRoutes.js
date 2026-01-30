const express = require("express");
const {
    verifyEmailUpdate,
    updateUserEmail,
    updateFullName,
    updateUsername,
    verifyPasswordReset,
    updateProfilePhoto,
    updateProfile,
    getProfile,
    updatePhoneNumber,
    updateUserLocation,
    deleteAccount
} = require("../controllers/accountControllers");
const {
    getAchievements,
    getBadges,
    getLeaderboard
} = require("../controllers/achievementControllers");
const {
    submitFeedback,
    getFeedbackQuota
} = require("../controllers/feedbackControllers");
const upload = require("../middlewares/uploadMiddleware");


const router = express.Router();

router.get('/account/profile', getProfile);
router.post('/update-user-email', updateUserEmail);
router.put('/update-full-name', updateFullName);
router.post('/update-email/verify', verifyEmailUpdate);
router.put('/update-username', updateUsername);
router.post('/reset-password/verify', verifyPasswordReset);
router.put('/update-profile-photo', upload.single('profilePhoto'), updateProfilePhoto);
router.put('/update-profile', updateProfile);
router.put('/update-phone', updatePhoneNumber);
router.patch('/location', updateUserLocation);
router.delete('/delete-account', deleteAccount);

// Achievement Routes
router.get('/achievements', getAchievements);
router.get('/badges', getBadges);
router.get('/leaderboard', getLeaderboard);

// Feedback Routes
router.post('/feedback', submitFeedback);
router.get('/feedback/quota', getFeedbackQuota);


module.exports = router;
