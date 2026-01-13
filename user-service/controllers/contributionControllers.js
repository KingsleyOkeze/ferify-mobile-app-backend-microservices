const contributionModel = require("../models/contributionModel");
const rewardModel = require("../models/rewardModel");
const userModel = require("../models/userModel");

const getContributionOverview = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        // Get or create rewards record
        let rewards = await rewardModel.findOne({ userId });
        if (!rewards) {
            rewards = await rewardModel.create({ userId, userPoint: 0, userBadge: 'Novice' });
        }

        // Aggregate some basic stats
        const totalContributions = await contributionModel.countDocuments({ userId });
        const helpedStats = await contributionModel.countDocuments({
            userId,
            type: { $in: ['fare_submission', 'route_confirmation'] }
        });

        // Mock "People Helped" multiplier for visual appeal in MVP
        const peopleHelped = helpedStats * 5;

        return res.status(200).json({
            stats: {
                points: rewards.userPoint,
                badge: rewards.userBadge,
                totalContributions,
                peopleHelped,
                routesConfirmed: await contributionModel.countDocuments({ userId, type: 'route_confirmation' }),
                faresUpdated: await contributionModel.countDocuments({ userId, type: 'fare_submission' })
            }
        });
    } catch (error) {
        console.error("Get contribution overview error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getContributionHistory = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { type } = req.query; // e.g., fare_submission, route_confirmation

    try {
        const query = { userId };
        if (type) {
            query.type = type;
        }

        const history = await contributionModel.find(query)
            .sort({ timestamp: -1 })
            .limit(50);

        return res.status(200).json({ history });
    } catch (error) {
        console.error("Get contribution history error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// Internal API called by other services
const recordContribution = async (req, res) => {
    const { userId, type, points, details } = req.body;

    if (!userId || !type) {
        return res.status(400).json({ error: "UserId and type are required" });
    }

    try {
        // Record the individual log
        await contributionModel.create({
            userId,
            type,
            pointsAwarded: points || 10,
            details
        });

        // Update the running total points
        await rewardModel.findOneAndUpdate(
            { userId },
            { $inc: { userPoint: points || 10 } },
            { upsert: true, new: true }
        );

        return res.status(200).json({ message: "Contribution recorded successfully" });
    } catch (error) {
        console.error("Record contribution error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// Trust & Reputation
const getTrustOverview = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        const user = await userModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        let rewards = await rewardModel.findOne({ userId });
        if (!rewards) {
            rewards = await rewardModel.create({ userId });
        }

        // --- Refined Trust Score Calculation (0-100) ---
        let score = 0;
        let breakdown = {
            identity: 0,
            activity: 0,
            impact: 0
        };

        // 1. Identity (Max 25 pts)
        if (user.isEmailVerified) breakdown.identity += 15;
        if (user.phoneNumber) breakdown.identity += 10;
        score += breakdown.identity;

        // 2. Activity (Max 35 pts)
        const totalContributions = await contributionModel.countDocuments({ userId });
        breakdown.activity = Math.min(totalContributions * 3, 35);
        score += breakdown.activity;

        // 3. Community Impact & Reliability (Max 40 pts)
        // For MVP: Verifications and "Helped" stats
        const relevantContributions = await contributionModel.countDocuments({
            userId,
            type: { $in: ['fare_submission', 'route_confirmation'] }
        });
        breakdown.impact = Math.min(relevantContributions * 5, 40);
        score += breakdown.impact;

        // Ensure score doesn't exceed 100
        score = Math.min(Math.round(score), 100);

        // Determine Level
        let level = 'Bronze';
        if (score > 85) level = 'Platinum';
        else if (score > 60) level = 'Gold';
        else if (score > 25) level = 'Silver';

        // Update DB
        rewards.trustScore = score;
        rewards.trustLevel = level;
        await rewards.save();

        return res.status(200).json({
            trustScore: score,
            trustLevel: level,
            breakdown,
            stats: {
                totalContributions,
                isVerified: user.isEmailVerified
            }
        });

    } catch (error) {
        console.error("Get trust overview error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getContributionOverview,
    getContributionHistory,
    recordContribution,
    getTrustOverview
};
