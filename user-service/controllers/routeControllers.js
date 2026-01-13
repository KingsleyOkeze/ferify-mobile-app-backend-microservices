const routeModel = require("../models/routeModel");

const saveRoute = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { type, title, address, latitude, longitude } = req.body;

    if (!type || !title || !address) {
        return res.status(400).json({ error: "Type, title and address are required" });
    }

    if (!['home', 'work'].includes(type)) {
        return res.status(400).json({ error: "Invalid route type" });
    }

    try {
        const route = await routeModel.findOneAndUpdate(
            { userId, type },
            { title, address, latitude, longitude },
            { upsert: true, new: true }
        );

        return res.status(200).json({ message: "Route saved successfully", route });
    } catch (error) {
        console.error("Save route error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getSavedRoutes = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        const routes = await routeModel.find({ userId });
        return res.status(200).json({ routes });
    } catch (error) {
        console.error("Get saved routes error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    saveRoute,
    getSavedRoutes
};
