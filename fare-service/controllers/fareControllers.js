const contributionModel = require("../models/contributionModel");
const estimateModel = require("../models/estimateModel");

/**
 * Calculates Interquartile Range (IQR) to identify and filter outliers.
 */
const filterOutliersIQR = (data) => {
    if (data.length < 4) return data; // Not enough data to reliably detect outliers
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor((sorted.length / 4))];
    const q3 = sorted[Math.floor((sorted.length * (3 / 4)))];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    return data.filter(x => x >= lowerBound && x <= upperBound);
};

const submitFarePriceFunction = async (req, res) => {
    try {
        const {
            userId,
            fromLocation, // Object { raw, placeId }
            toLocation,   // Object { raw, placeId }
            vehicleType,
            fareAmount,
            timeOfDay,
            conditions,
            notes,
            location // New: { coordinates: [lng, lat] }
        } = req.body;

        if (!userId || !fromLocation || !toLocation || !vehicleType || !fareAmount || !timeOfDay) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const newContribution = new contributionModel({
            userId,
            origin: fromLocation,
            destination: toLocation,
            vehicleType,
            fareAmount: Number(fareAmount),
            timeOfDay,
            conditions,
            notes,
            location: location || { type: 'Point', coordinates: [0, 0] }
        });

        await newContribution.save();

        // Socket.io Push (To be integrated in server.js)
        if (req.io) {
            req.io.emit('nearby_contribution', {
                id: newContribution._id,
                from: fromLocation.raw,
                to: toLocation.raw,
                vehicleType,
                fareAmount: Number(fareAmount),
                timestamp: newContribution.timestamp,
                location: newContribution.location
            });
        }

        res.status(201).json({ message: "Contribution received. Thank you!", newContribution });

    } catch (error) {
        console.error("Submission error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const getNearbyFaresFunction = async (req, res) => {
    try {
        const { lng, lat, radius = 5000 } = req.query; // Default 5km radius

        let query = { isFlagged: false };
        let options = {};

        // If location is provided, use geospatial search
        if (lng && lat) {
            query.location = {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(radius)
                }
            };
        }

        let nearbyFares = await contributionModel.find(query)
            .sort({ timestamp: -1 })
            .limit(3);

        let isLocal = !!(lng && lat && nearbyFares.length > 0);

        // If no nearby fares found, fallback to global latest (if we used proximity)
        if (nearbyFares.length === 0 && lng && lat) {
            console.log("No nearby fares found, falling back to global latest");
            nearbyFares = await contributionModel.find({ isFlagged: false })
                .sort({ timestamp: -1 })
                .limit(3);
            isLocal = false;
        }


        // Format for mobile app (matching sharedFares structure)
        const formattedFares = nearbyFares.map(fare => ({
            id: fare._id,
            from: fare.origin.raw.split(',')[0], // Take city/area part
            to: fare.destination.raw.split(',')[0],
            time: formatTimeAgo(fare.timestamp),
            contributors: 1, // Individual contribution for feed
            priceRange: `₦${fare.fareAmount}`,
            vehicleType: fare.vehicleType,
            image: getTransportImage(fare.vehicleType)
        }));

        res.status(200).json({
            fares: formattedFares,
            isLocal
        });

    } catch (error) {
        console.error("Nearby fares error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Helper for relative time
const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
};

// Map backend vehicle types to frontend asset references (logical mock names for now)
const getTransportImage = (type) => {
    // In production, these should be shared constants
    return type === 'bus' ? 'busImage' : type === 'keke' ? 'kekeImage' : 'bikeImage';
};

const getFareEstimateFunction = async (req, res) => {
    try {
        const { from, to, vehicle } = req.query;

        if (!from || !to || !vehicle) {
            return res.status(400).json({ error: "From, To, and Vehicle type are required" });
        }

        // 1. Check if we have a fresh estimate in cache
        const cachedEstimate = await estimateModel.findOne({
            origin: from,
            destination: to,
            vehicleType: vehicle
        });

        const CACHE_TTL = 1000 * 60 * 60; // 1 hour
        if (cachedEstimate && (Date.now() - new Date(cachedEstimate.lastUpdated).getTime() < CACHE_TTL)) {
            return res.status(200).json(cachedEstimate);
        }

        // 2. No fresh cache? Calculate from recent contributions
        // Look back 7 days by default
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - 7);

        const contributions = await contributionModel.find({
            "origin.raw": from,
            "destination.raw": to,
            vehicleType: vehicle,
            timestamp: { $gte: lookbackDate },
            isFlagged: false
        });

        if (contributions.length === 0) {
            return res.status(404).json({ message: "No recent fare data for this route. Be the first to contribute!" });
        }

        // 3. Algorithm: IQR Filter -> Weighted Mean
        const amounts = contributions.map(c => c.fareAmount);
        const filteredAmounts = filterOutliersIQR(amounts);

        if (filteredAmounts.length === 0) {
            return res.status(404).json({ message: "Data points are too inconsistent to provide a reliable estimate." });
        }

        // Simple Mean for MVP (could be weighted by time/reputation)
        const sum = filteredAmounts.reduce((a, b) => a + b, 0);
        const avg = sum / filteredAmounts.length;

        // Calculate dynamic range (standard deviation or min/max of filtered)
        const min = Math.min(...filteredAmounts);
        const max = Math.max(...filteredAmounts);

        // Determine Reliability
        let reliability = 'Low';
        if (filteredAmounts.length > 20) reliability = 'High';
        else if (filteredAmounts.length > 5) reliability = 'Medium';

        const estimateData = {
            origin: from,
            destination: to,
            vehicleType: vehicle,
            minFare: Math.floor(min / 10) * 10, // Round to nearest 10
            maxFare: Math.ceil(max / 10) * 10,
            avgFare: Math.round(avg / 10) * 10,
            reliabilityScore: reliability,
            contributorCount: contributions.length,
            lastUpdated: new Date(),
            isVolatile: (max - min) / avg > 0.5 // If range is > 50% of avg, it's volatile
        };

        // 4. Update Cache
        await estimateModel.findOneAndUpdate(
            { origin: from, destination: to, vehicleType: vehicle },
            estimateData,
            { upsert: true, new: true }
        );

        res.status(200).json(estimateData);

    } catch (error) {
        console.error("Estimation error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


const getPopularRoutesFunction = async (req, res) => {
    try {
        // Aggregate top 5 routes by contribution count in the last 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const popular = await contributionModel.aggregate([
            { $match: { timestamp: { $gte: yesterday }, isFlagged: false } },
            {
                $group: {
                    _id: { from: "$origin.raw", to: "$destination.raw" },
                    count: { $sum: 1 },
                    avgFare: { $avg: "$fareAmount" },
                    vehicleType: { $first: "$vehicleType" }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 4 }
        ]);

        const formatted = popular.map((p, idx) => ({
            id: `pop-${idx}`,
            route: `${p._id.from.split(',')[0]} - ${p._id.to.split(',')[0]}`,
            priceRange: `₦${Math.round(p.avgFare)}`,
            time: "Popular Now",
            points: 80,
            vehicleType: p.vehicleType,
            image: getTransportImage(p.vehicleType)
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error("Popular routes error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const getCommunityInsightsFunction = async (req, res) => {
    try {
        // Return some contextual insights
        // In a real app, this would check standard deviation and volume spikes
        const insights = [
            {
                id: '1',
                title: 'High Reliability',
                body: 'Fare prices are stable today. Most routes are matching estimates.',
                image: 'shine'
            },
            {
                id: '2',
                title: 'Contributor Bonus',
                body: 'Double points for any route contributions in Ikeja today!',
                image: 'shine'
            }
        ];
        res.status(200).json(insights);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

const deleteUserContributions = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const result = await contributionModel.deleteMany({ userId });
        console.log(`Deleted ${result.deletedCount} contributions for user ${userId}`);

        res.status(200).json({
            message: "User contributions deleted successfully",
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error("Delete user contributions error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    submitFarePriceFunction,
    getFareEstimateFunction,
    getNearbyFaresFunction,
    getPopularRoutesFunction,
    getCommunityInsightsFunction,
    deleteUserContributions
};
