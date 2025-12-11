const express = require("express");
const {
    placeSearchFunction
} = require("../controllers/fareAlgorithm")

const router = express.Router();

router.get("/suggest", placeSearchFunction);


module.exports = router;