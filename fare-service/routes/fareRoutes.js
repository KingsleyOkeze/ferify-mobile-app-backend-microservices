const express = require("express");
const {
    getFareEstimateFunction,
    submitFarePriceFunction,
    getNearbyFaresFunction,
    getPopularRoutesFunction,
    getCommunityInsightsFunction,
    deleteUserContributions
} = require('../controllers/fareControllers');

const { fareSubmissionRateLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.get('/estimate', getFareEstimateFunction);
router.post('/submit', fareSubmissionRateLimiter, submitFarePriceFunction);
router.get('/nearby', getNearbyFaresFunction);
router.get('/popular', getPopularRoutesFunction);
router.get('/insights', getCommunityInsightsFunction);
router.delete('/internal/user/:userId', deleteUserContributions);

module.exports = router;
