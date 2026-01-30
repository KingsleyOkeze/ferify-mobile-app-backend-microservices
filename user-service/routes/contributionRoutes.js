const express = require("express");
const {
    getContributionOverview,
    getContributionHistory,
    recordContribution
} = require("../controllers/contributionControllers");

const router = express.Router();

router.get('/overview', getContributionOverview);
router.get('/history', getContributionHistory);
// router.get('/trust', getTrustOverview);

// Internal route for other services
router.post('/internal/record', recordContribution);

module.exports = router;
