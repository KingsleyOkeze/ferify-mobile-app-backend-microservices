const express = require("express");
const {
    getFareEstimateFunction,
    submitFarePriceFunction
} = require("../controllers/fareAlgorithm")

const router = express.Router();

router.get('/estimate', getFareEstimateFunction);
router.post('/submit-price', submitFarePriceFunction);


module.exports = router;