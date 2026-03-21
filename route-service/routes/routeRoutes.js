const express = require("express");
const { routeBreakdownFunction, placeSearchFunction, getPlaceCoordinatesFunction } = require("../controllers/routeControllers");

const router = express.Router();

// GET /route/placesearch (Autocomplete)
router.get('/placesearch', placeSearchFunction);

// GET /route/place-coordinates (Details)
router.get('/place-coordinates', getPlaceCoordinatesFunction);

// POST /route/route-breakdown (Directions)
router.post('/route-breakdown', routeBreakdownFunction)


module.exports = router;