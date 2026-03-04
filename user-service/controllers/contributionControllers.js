const mongoose = require("mongoose");
const contributionModel = require("../models/contributionModel");
const rewardModel = require("../models/rewardModel");
const userModel = require("../models/userModel");
const internalApi = require("../configs/internalApi");

const getContributionOverview = async (req, res) => {
    let userId = req.headers['x-user-id'];
    console.log(`[DEBUG] getContributionOverview called for x-user-id: ${userId}`);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const objectUserId = new mongoose.Types.ObjectId(userId);
        console.log(`[DEBUG] Querying with userId: ${userId} and objectUserId: ${objectUserId}`);

        const userFilter = { $or: [{ userId: userId }, { userId: objectUserId }] };

        // Get or create rewards record
        let rewards = await rewardModel.findOne(userFilter);
        if (!rewards) {
            rewards = await rewardModel.create({ userId: objectUserId, userPoint: 0, userBadge: 'Novice' });
        }

        // Aggregate some basic stats
        const totalContributions = await contributionModel.countDocuments(userFilter);
        const helpedStats = await contributionModel.countDocuments({
            ...userFilter,
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
    let userId = req.headers['x-user-id'];
    console.log(`[DEBUG] getContributionHistory called for x-user-id: ${userId}, type: ${req.query.type}`);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { type } = req.query;

    try {
        const objectUserId = new mongoose.Types.ObjectId(userId);
        const userFilter = { $or: [{ userId: userId }, { userId: objectUserId }] };

        const query = { ...userFilter };
        if (type) {
            query.type = type;
        }
        console.log(`[DEBUG] Querying history with:`, query);

        const history = await contributionModel.find(query)
            .sort({ createdAt: -1 })
            .limit(50);

        console.log(`[DEBUG] Found ${history.length} history items`);

        return res.status(200).json({ history });
    } catch (error) {
        console.error("Get contribution history error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// Internal API called by other services
const recordContribution = async (req, res) => {
    const { userId, type, points, details } = req.body;
    console.log(`[DEBUG] recordContribution called for userId: ${userId}, type: ${type}`);

    if (!userId || !type) {
        return res.status(400).json({ error: "UserId and type are required" });
    }

    try {
        const objectUserId = new mongoose.Types.ObjectId(userId);
        const userFilter = { $or: [{ userId: userId }, { userId: objectUserId }] };

        // Record the individual log
        console.log(`[DEBUG] Creating contribution record for ${objectUserId}`);
        await contributionModel.create({
            userId: objectUserId,
            type,
            pointsAwarded: points || 10,
            details
        });

        const reward = await rewardModel.findOneAndUpdate(
            userFilter,
            {
                $inc: { userPoint: points || 10 },
                $set: { helpedCount: await contributionModel.countDocuments(userFilter) } // Sync helped count
            },
            { upsert: true, new: true }
        );

        // --- AUTOMATED BADGE UNLOCKING SYSTEM ---
        const badgeMilestones = [
            { id: 'starter', type: 'fare_submission', threshold: 1, title: 'Fare Starter 🏅', desc: 'You earned the Fare Starter badge by sharing your first fare.' },
            { id: 'helper', type: 'route_confirmation', threshold: 5, title: 'Route Helper 🤝', desc: 'Unlocked! You helped 5 people find their way.' },
            { id: 'dropper', total: true, threshold: 20, title: 'Fare Dropper 📍', desc: 'Impressive! You have shared 20 updates with the community.' },
            { id: 'checker', type: 'route_confirmation', threshold: 5, title: 'Fare Checker ✅', desc: 'You verified 5 fares to keep Ferify accurate!' },
            { id: 'report_helper', type: 'incorrect_report', threshold: 20, title: 'Report Helper 🛡️', desc: 'You reported 20 errors. Thanks for keeping our data clean!' },
            { id: 'mapper', type: 'fare_submission', threshold: 10, title: 'Local Mapper 🗺️', desc: 'Unlocked! You provided 10 location updates.' },
            { id: 'guardian', type: 'route_confirmation', threshold: 15, title: 'Route Guardian 🛡️', desc: '15 confirmations! You are a true protector of accuracy.' },
            { id: 'danfo', type: 'fare_submission', vehicle: 'bus', threshold: 15, title: 'Danfo Master 🚐', desc: 'Unlocked! You submitted 15 danfo fares.' },
            { id: 'keke', type: 'fare_submission', vehicle: 'keke', threshold: 15, title: 'Keke Master 🛺', desc: 'Unlocked! You submitted 15 keke fares.' },
        ];

        for (const milestone of badgeMilestones) {
            if (reward.earnedBadges.includes(milestone.id)) continue;

            let count = 0;
            if (milestone.total) {
                count = await contributionModel.countDocuments({ userId: objectUserId });
            } else if (milestone.vehicle) {
                count = await contributionModel.countDocuments({
                    userId: objectUserId,
                    type: milestone.type,
                    'details.vehicleType': milestone.vehicle
                });
            } else {
                count = await contributionModel.countDocuments({ userId: objectUserId, type: milestone.type });
            }

            if (count >= milestone.threshold) {
                reward.earnedBadges.push(milestone.id);
                await reward.save();

                // Notify user about new badge
                try {
                    await internalApi.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/notification/internal/create`, {
                        userId,
                        type: 'earned_badge',
                        title: milestone.title,
                        description: milestone.desc,
                        data: { badgeId: milestone.id, screen: '/achievement/BadgesScreen' }
                    });
                } catch (err) {
                    console.error(`Failed to send ${milestone.id} badge notification:`, err.message);
                }
            }
        }

        // Notify user about points earned
        try {
            await internalApi.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/notification/internal/create`, {
                userId,
                type: 'points_earned',
                title: 'Points Earned! ⭐',
                description: `You just earned ${points || 10} points for your ${type.replace('_', ' ')}.`,
                data: { points, type }
            });
        } catch (err) {
            console.error("Failed to send points notification:", err.message);
        }

        return res.status(200).json({ message: "Contribution recorded successfully" });
    } catch (error) {
        console.error("Record contribution error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getTrustOverview = async (req, res) => {
    let userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const objectUserId = new mongoose.Types.ObjectId(userId);
        const user = await userModel.findById(objectUserId);
        if (!user) return res.status(404).json({ error: "User not found" });

        let rewards = await rewardModel.findOne({ userId: objectUserId });
        if (!rewards) {
            rewards = await rewardModel.create({ userId: objectUserId });
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
        const totalContributions = await contributionModel.countDocuments({ userId: objectUserId });
        breakdown.activity = Math.min(totalContributions * 3, 35);
        score += breakdown.activity;

        // 3. Community Impact & Reliability (Max 40 pts)
        // For MVP: Verifications and "Helped" stats
        const relevantContributions = await contributionModel.countDocuments({
            userId: objectUserId,
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
