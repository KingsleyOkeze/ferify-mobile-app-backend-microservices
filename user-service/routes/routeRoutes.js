const express = require("express");
const { saveRoute, getSavedRoutes } = require("../controllers/routeControllers");

const router = express.Router();

router.get('/saved-routes', getSavedRoutes);
router.post('/save-route', saveRoute);

module.exports = router;
