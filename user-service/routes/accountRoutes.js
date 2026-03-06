const express = require("express");
const {
    verifyEmailUpdate,
    updateUserEmail,
    updateFullName,
    updateUsername,
    verifyPasswordReset,
    initiatePasswordReset,
    updateProfilePhoto,
    updateProfile,
    getProfile,
    updatePhoneNumber,
    updateUserLocation,
    deleteAccount,
    updatePushToken,
    getNearbyPushTokens,
    getRouteContributorsTokens,
    getUserPushData
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
const {
    getPrivacySettings,
    updatePrivacySettings
} = require("../controllers/privacyControllers");
const {
    requestDataExport,
    getExportStatus,
    downloadExport
} = require("../controllers/dataExportControllers");
const { triggerCleanup } = require("../utils/cleanupExports");
const upload = require("../middlewares/uploadMiddleware");


const router = express.Router();

router.get('/profile', getProfile);
router.post('/update-user-email', updateUserEmail);
router.put('/update-full-name', updateFullName);
router.post('/update-email/verify', verifyEmailUpdate);
router.put('/update-username', updateUsername);
router.post('/reset-password/initiate', initiatePasswordReset);
router.post('/reset-password/verify', verifyPasswordReset);
router.put('/update-profile-photo', upload.single('profilePhoto'), updateProfilePhoto);
router.put('/update-profile', updateProfile);
router.put('/update-phone', updatePhoneNumber);
router.patch('/location', updateUserLocation);
router.put('/update-push-token', updatePushToken);
router.delete('/delete-account', deleteAccount);

// Achievement Routes
router.get('/achievements', getAchievements);
router.get('/badges', getBadges);
router.get('/leaderboard', getLeaderboard);

// Feedback Routes
router.post('/feedback', submitFeedback);
router.get('/feedback/quota', getFeedbackQuota);

// Privacy Routes
router.get('/privacy', getPrivacySettings);
router.patch('/privacy/update', updatePrivacySettings);

// Data Export Routes
router.post('/data-export/request', requestDataExport);
router.get('/data-export/status/:jobId', getExportStatus);
router.get('/data-export/download/:jobId', downloadExport);

// Internal Routes
router.get('/internal/nearby-push-tokens', getNearbyPushTokens);
router.post('/internal/route-contributors-tokens', getRouteContributorsTokens);
router.get('/internal/push-data', getUserPushData);

module.exports = router;
