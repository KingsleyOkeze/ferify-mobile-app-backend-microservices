const express = require("express");
const { routeBreakdownFunction, placeSearchFunction,  } = require("../controllers/routeControllers");

const router = express.Router();

// GET /route/placesearch (Autocomplete)
router.get('/placesearch', placeSearchFunction);

// POST /route/route-breakdown (Directions)
router.post('/route-breakdown', routeBreakdownFunction)

// GET /route/distance (Internal/External)
// router.get('/distance', );

module.exports = router;