const contributionModel = require("../models/contributionModel");
const estimateModel = require("../models/estimateModel");
const internalApi = require("../configs/internalApi");

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

const haversineDistance = (coords1, coords2) => {
    const R = 6371; // km
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // meters
};

const submitFarePriceFunction = async (req, res) => {
    try {
        const {
            userId,
            fromLocation,
            toLocation,
            vehicleType,
            fareAmount,
            timeOfDay,
            conditions,
            notes,
            location, // { coordinates: [lng, lat] }
            contributionType
        } = req.body;

        if (!userId || !fromLocation || !toLocation || !vehicleType || !fareAmount || !timeOfDay) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // --- CITY GUARD: GEOGRAPHICAL VALIDATION ---
        let isVerified = false;
        let isLive = false;
        let distanceToOrigin = 0;
        let tripLength = 0;

        try {
            const routeServiceUrl = process.env.ROUTE_SERVICE_URL || 'http://localhost:5001';
            
            // 1. Resolve Trip Coordinates
            const [originCoordsRes, destCoordsRes] = await Promise.all([
                internalApi.get(`${routeServiceUrl}/api/route/place-coordinates`, { params: { placeId: fromLocation.placeId } }),
                internalApi.get(`${routeServiceUrl}/api/route/place-coordinates`, { params: { placeId: toLocation.placeId } })
            ]);

            const originCoords = originCoordsRes.data;
            const destCoords = destCoordsRes.data;

            // 2. Calculate Trip Length (Intra-city Check)
            tripLength = haversineDistance(originCoords, destCoords);
            if (tripLength > 150000) { // 150km limit for commuter fares
                console.warn(`REJECTED: Trip length too long (${(tripLength/1000).toFixed(1)}km) for ${fromLocation.raw} -> ${toLocation.raw}`);
                return res.status(400).json({ 
                    error: "This route is too long for a local transit fare. Ferify currently only supports intra-city commuting." 
                });
            }

            // 3. User Proximity Check (Spam/Remote Check)
            if (location && location.coordinates && location.coordinates[0] !== 0) {
                const userCoords = { lng: location.coordinates[0], lat: location.coordinates[1] };
                distanceToOrigin = haversineDistance(userCoords, originCoords);

                if (distanceToOrigin > 100000) { // 100km limit for remote submissions
                    console.warn(`REJECTED: User is too far (${(distanceToOrigin/1000).toFixed(1)}km) from trip origin.`);
                    return res.status(400).json({ 
                        error: "You are too far from this location to report a live fare. Please only report fares for areas you have recently visited." 
                    });
                }

                // Tiered Trust
                if (distanceToOrigin < 5000) { // Within 5km
                    isVerified = true;
                    isLive = true;
                } else if (distanceToOrigin < 30000) { // Within 30km (City Level)
                    isVerified = true;
                    isLive = false; // Not "Live" real-time evidence, but a verified historical contribution
                }
            }
        } catch (geoError) {
            console.error("City Guard Validation failed (Failing to unverified):", geoError.message);
            // We allow the contribution to pass but it stays unverified
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
            location: location || { type: 'Point', coordinates: [0, 0] },
            isVerified,
            isLive,
            accuracyMetadata: {
                distanceToOrigin,
                tripLength
            }
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

        // Trigger Push Notification for Nearby Users
        if (location && location.coordinates) {
            const [lng, lat] = location.coordinates;

            // Fetch nearby push tokens and broadcast (Async/Don't block response)
            (async () => {
                try {
                    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
                    const notifServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5004';

                    // Alert Nearby Users about the new fare
                    const tokenResponse = await internalApi.get(`${userServiceUrl}/internal/nearby-push-tokens`, {
                        params: { lng, lat, radius: 10000 } // 10km radius
                    });

                    const nearbyTokens = tokenResponse.data.tokens;

                    if (nearbyTokens && nearbyTokens.length > 0) {
                        const fromName = fromLocation.raw.split(',')[0];
                        const toName = toLocation.raw.split(',')[0];

                        await internalApi.post(`${notifServiceUrl}/notification/push/send`, {
                            tokens: nearbyTokens,
                            title: "New Fare Nearby! 🚗",
                            body: `Someone just shared a fare from ${fromName} to ${toName}. Check it out!`,
                            data: { screen: "HomeScreen" }
                        });
                    }

                    // Alert Previous Contributors (Community Milestone)
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                    const recentContributions = await contributionModel.find({
                        "origin.raw": fromLocation.raw,
                        "destination.raw": toLocation.raw,
                        vehicleType,
                        timestamp: { $gte: sevenDaysAgo },
                        userId: { $ne: userId } // Don't notify the current user
                    }).select('userId');

                    const contributorIds = [...new Set(recentContributions.map(c => c.userId))];

                    if (contributorIds.length > 0) {
                        const contributorTokenResponse = await internalApi.post(`${userServiceUrl}/internal/route-contributors-tokens`, {
                            userIds: contributorIds
                        });

                        const contributorTokens = contributorTokenResponse.data.tokens;

                        if (contributorTokens && contributorTokens.length > 0) {
                            const fromName = fromLocation.raw.split(',')[0];
                            const toName = toLocation.raw.split(',')[0];

                            await internalApi.post(`${notifServiceUrl}/notification/push/send`, {
                                tokens: contributorTokens,
                                title: "Community Impact!",
                                body: `Your shared fare for ${fromName} → ${toName} was just confirmed by another user. Way to help the community!`,
                                data: { screen: "MyContributionOverviewScreen" }
                            });

                            // Create internal notification records for contributors
                            for (const contributorId of contributorIds) {
                                await internalApi.post(`${notifServiceUrl}/api/notification/internal/create`, {
                                    userId: contributorId,
                                    type: 'fare_confirmed',
                                    title: "Community Impact!",
                                    description: `Your shared fare for ${fromName} → ${toName} was just confirmed by another user.`,
                                    data: { screen: "MyContributionOverviewScreen" }
                                });
                            }
                        }
                    }

                } catch (pushError) {
                    console.error("Delayed push notification trigger failed:", pushError.message);
                }
            })();
        }

        // Also notify the person who just shared that their fare is live (Fare Verified)
        (async () => {
            try {
                const notifServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5004';
                const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';

                // Record Contribution in user-service (Points & Badges)
                await internalApi.post(`${userServiceUrl}/internal/record`, {
                    userId,
                    type: contributionType || 'fare_submission',
                    points: 50,
                    details: {
                        contributionId: newContribution._id,
                        from: fromLocation.raw,
                        to: toLocation.raw,
                        vehicleType,
                        fareAmount: Number(fareAmount),
                        timeOfDay
                    }
                })
                    .then(() => console.log(`[MIRROR] Successfully recorded contribution for user ${userId}`))
                    .catch(err => console.error(`[MIRROR] Failed to record contribution for user ${userId}:`, err.message));

                // Create internal notification 
                await internalApi.post(`${notifServiceUrl}/api/notification/internal/create`, {
                    userId: userId,
                    type: 'fare_verified',
                    title: "Fare Verified ✅",
                    description: `Your contribution from ${fromLocation.raw.split(',')[0]} to ${toLocation.raw.split(',')[0]} is now live.`,
                    data: { contributionId: newContribution._id }
                });
            } catch (err) {
                console.error("Self notified verify failed:", err.message);
            }
        })();

        return res.status(201).json({ message: "Contribution received. Thank you!", newContribution });

    } catch (error) {
        console.error("Submission error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getNearbyFaresFunction = async (req, res) => {
    try {
        const { lng, lat, radius = 5000 } = req.query; // Default 5km radius

        let pipeline = [
            { $match: { isFlagged: false } }
        ];

        // Geospatial search if coordinates provided
        if (lng && lat) {
            pipeline.unshift({
                $geoNear: {
                    near: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    distanceField: "dist.calculated",
                    maxDistance: parseInt(radius),
                    spherical: true
                }
            });
        }

        // Filter by time (7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        pipeline.push({ $match: { timestamp: { $gte: sevenDaysAgo } } });

        // Group by Route & Vehicle Type
        pipeline.push({
            $group: {
                _id: {
                    from: "$origin.raw",
                    to: "$destination.raw",
                    vehicleType: "$vehicleType"
                },
                minFare: { $min: "$fareAmount" },
                maxFare: { $max: "$fareAmount" },
                lastTimestamp: { $max: "$timestamp" },
                contributorCount: { $sum: 1 }
            }
        });

        // 4. Sort and Limit
        pipeline.push(
            { $sort: { lastTimestamp: -1 } },
            { $limit: 3 }
        );

        let nearbyResults = await contributionModel.aggregate(pipeline);

        let isLocal = true;
        if (nearbyResults.length === 0) {
            isLocal = true;
        }

        // Format for mobile app
        const formattedFares = nearbyResults.map((fare, idx) => {
            const min = Math.round(fare.minFare);
            const max = Math.round(fare.maxFare);
            const priceRange = min === max ? `₦${min}` : `₦${min} - ₦${max}`;

            return {
                id: `nearby-${idx}`,
                from: fare._id.from.split(',')[0],
                to: fare._id.to.split(',')[0],
                time: formatTimeAgo(fare.lastTimestamp),
                contributors: fare.contributorCount,
                priceRange: priceRange,
                vehicleType: fare._id.vehicleType,
                image: getTransportImage(fare._id.vehicleType)
            };
        });

        return res.status(200).json({
            fares: formattedFares,
            isLocal
        });

    } catch (error) {
        console.error("Nearby fares error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// Helper for relative time
const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / (3600 * 24);
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
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

        // Check if we have a fresh estimate in cache
        const cachedEstimate = await estimateModel.findOne({
            origin: from,
            destination: to,
            vehicleType: vehicle
        });

        const CACHE_TTL = 1000 * 60 * 60; // 1 hour
        if (cachedEstimate && (Date.now() - new Date(cachedEstimate.lastUpdated).getTime() < CACHE_TTL)) {
            return res.status(200).json(cachedEstimate);
        }

        // No fresh cache? Calculate from recent contributions
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

        // Algorithm: IQR Filter -> Weighted Mean
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

        // Update Cache
        await estimateModel.findOneAndUpdate(
            { origin: from, destination: to, vehicleType: vehicle },
            estimateData,
            { upsert: true, new: true }
        );

        return res.status(200).json(estimateData);

    } catch (error) {
        console.error("Estimation error:", error);
        return res.status(500).json({ error: "Internal server error" });
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
                    minFare: { $min: "$fareAmount" },
                    maxFare: { $max: "$fareAmount" },
                    vehicleType: { $first: "$vehicleType" },
                    lastTimestamp: { $max: "$timestamp" }
                }
            },
            { $sort: { lastTimestamp: -1 } },
            { $limit: 4 }
        ]);

        const formatted = popular.map((p, idx) => {
            const min = Math.round(p.minFare);
            const max = Math.round(p.maxFare);
            const priceRange = min === max ? `₦${min}` : `₦${min} - ₦${max}`;

            // Helper to format as "3:55pm"
            const formatTime = (date) => {
                const d = new Date(date);
                let hours = d.getHours();
                const minutes = d.getMinutes();
                const ampm = hours >= 12 ? 'pm' : 'am';
                hours = hours % 12;
                hours = hours ? hours : 12; // the hour '0' should be '12'
                const strMinutes = minutes < 10 ? '0' + minutes : minutes;
                return hours + ':' + strMinutes + ampm;
            };

            return {
                id: `pop-${idx}`,
                route: `${p._id.from.split(',')[0]} - ${p._id.to.split(',')[0]}`,
                priceRange,
                time: formatTime(p.lastTimestamp),
                points: 80,
                vehicleType: p.vehicleType,
                image: getTransportImage(p.vehicleType)
            };
        });

        return res.status(200).json(formatted);
    } catch (error) {
        console.error("Popular routes error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getCommunityInsightsFunction = async (req, res) => {
    try {
        const { lng, lat } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let geoNearStage = null;
        if (lng && lat) {
            geoNearStage = {
                $geoNear: {
                    near: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    distanceField: "dist.calculated",
                    maxDistance: 20000, // 20km
                    spherical: true,
                    query: { isFlagged: false }
                }
            };
        }

        // Find Top Local Route
        const topRoutePipeline = [];
        if (geoNearStage) topRoutePipeline.push(geoNearStage);
        topRoutePipeline.push(
            { $match: { timestamp: { $gte: today }, isFlagged: false, isVerified: true } },
            {
                $group: {
                    _id: { from: "$origin.raw", to: "$destination.raw" },
                    count: { $sum: 1 },
                    avgDist: { $avg: "$dist.calculated" }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 1 }
        );

        const topRouteResult = await contributionModel.aggregate(topRoutePipeline);
        const topRoute = topRouteResult.length > 0 ? topRouteResult[0]._id : null;

        // Calculate Dynamic Peak Hour and Surge % for the Top Route
        let peakHourText = "7-9 AM"; // Default fallback
        let surgePercent = 20; // Default
        if (topRoute) {
            const peakAnalysis = await contributionModel.aggregate([
                {
                    $match: {
                        "origin.raw": topRoute.from,
                        "destination.raw": topRoute.to,
                        isFlagged: false,
                        isVerified: true
                    }
                },
                {
                    $group: {
                        _id: { $hour: "$timestamp" },
                        count: { $sum: 1 },
                        avgFare: { $avg: "$fareAmount" }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            if (peakAnalysis.length > 0) {
                // Adjust for West Africa Time (GMT+1)
                const hour = (peakAnalysis[0]._id + 1) % 24;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                peakHourText = `${displayHour}-${(hour + 2) % 12 || 12} ${ampm}`;

                // Calculate % Increase from min reported average to peak average
                if (peakAnalysis.length > 1) {
                    const sortedByFare = [...peakAnalysis].sort((a, b) => a.avgFare - b.avgFare);
                    const minAvg = sortedByFare[0].avgFare;
                    const maxAvg = peakAnalysis[0].avgFare;

                    if (minAvg > 0) {
                        const calculatedSurge = Math.round(((maxAvg - minAvg) / minAvg) * 100);
                        if (calculatedSurge > 0 && calculatedSurge < 100) {
                            surgePercent = calculatedSurge;
                        }
                    }
                }
            }
        }

        // Dynamic Time Savings (Distance-based heuristic)
        const distKm = topRouteResult.length > 0 && topRouteResult[0].avgDist ? (topRouteResult[0].avgDist / 1000) : 5;
        const timeSavings = Math.max(5, Math.min(30, Math.round(distKm * 2.5)));

        // Traffic Alert (Last 2 hours in location)
        const twoHoursAgo = new Date(Date.now() - 7200000);
        const trafficPipeline = [];
        if (geoNearStage) trafficPipeline.push(geoNearStage);
        trafficPipeline.push(
            { $match: { timestamp: { $gte: twoHoursAgo }, isFlagged: false, isLive: true } },
            { $group: { _id: "$destination.raw", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        );

        const trafficResult = await contributionModel.aggregate(trafficPipeline);
        const trafficLocation = trafficResult.length > 0
            ? trafficResult[0]._id.split(',')[0]
            : (lng && lat ? "nearby routes" : "Third Mainland Bridge");

        const peakTarget = topRoute ? topRoute.to.split(',')[0] : "Lekki";
        const fastTarget = topRoute ? topRoute.to.split(',')[0] : "Marina";

        const insights = [
            {
                id: '1',
                title: 'Peak hour alert',
                body: `Fares to ${peakTarget} are trending ${surgePercent}% higher during peak hours (${peakHourText}).`,
                image: 'shine'
            },
            {
                id: '2',
                title: 'Fast route',
                body: `Keke to ${fastTarget} is typically ${timeSavings} mins faster than bus during weekdays.`,
                image: 'shine'
            },
            {
                id: '3',
                title: 'Traffic update',
                body: `Heavy activity reported towards ${trafficLocation}. Consider alternative routes.`,
                image: 'shine'
            }
        ];

        return res.status(200).json(insights);
    } catch (error) {
        console.error("Community insights error:", error);
        return res.status(500).json({ error: "Internal server error" });
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

        return res.status(200).json({
            message: "User contributions deleted successfully",
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error("Delete user contributions error:", error);
        return res.status(500).json({ error: "Internal server error" });
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
