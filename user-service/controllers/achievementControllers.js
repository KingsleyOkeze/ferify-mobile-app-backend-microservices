const rewardModel = require("../models/rewardModel");
const userModel = require("../models/userModel");
const contributionModel = require("../models/contributionModel");

const getAchievements = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        let reward = await rewardModel.findOne({ userId });

        if (!reward) {
            // Create a default reward record if it doesn't exist
            reward = await rewardModel.create({ userId });
        }

        // Return data in a format the frontend expects
        res.status(200).json({
            points: reward.userPoint,
            helped: reward.helpedCount || 0,
            level: reward.level || 1,
            earnedBadges: reward.earnedBadges || [],
            trustScore: reward.trustScore,
            trustLevel: reward.trustLevel
        });
    } catch (error) {
        console.error("Error fetching achievements:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const getBadges = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        const reward = await rewardModel.findOne({ userId });
        const earnedBadges = reward ? reward.earnedBadges : [];

        // Fetch relevant counts from the database
        const totalContributions = await contributionModel.countDocuments({ userId });
        const fareSubmissions = await contributionModel.countDocuments({ userId, type: 'fare_submission' });
        const routeConfirmations = await contributionModel.countDocuments({ userId, type: 'route_confirmation' });
        const reports = await contributionModel.countDocuments({ userId, type: 'incorrect_report' });

        const danfoFares = await contributionModel.countDocuments({
            userId,
            type: 'fare_submission',
            'details.vehicleType': 'bus'
        });
        const kekeFares = await contributionModel.countDocuments({
            userId,
            type: 'fare_submission',
            'details.vehicleType': 'keke'
        });

        // Define Badge Metadata and logic
        const allBadges = [
            {
                id: 'starter',
                title: 'fare starter',
                description: 'Submit your first fare to unlock this badge.',
                requirements: ['1st fare'],
                totalAim: 1,
                currentProgress: Math.min(fareSubmissions, 1)
            },
            {
                id: 'helper',
                title: 'route helper',
                description: 'Confirm or improve 5 routes to help others get to their destination easily.',
                requirements: ['5 routes'],
                totalAim: 5,
                currentProgress: routeConfirmations
            },
            {
                id: 'dropper',
                title: 'fare dropper',
                description: 'Submit fares, routes, or reports 20 times to unlock this badge.',
                requirements: ['20 fare drops'],
                totalAim: 20,
                currentProgress: totalContributions
            },
            {
                id: 'checker',
                title: 'fare checker',
                description: 'Verify or confirm 5 fares or routes submitted by others to keep Ferify accurate.',
                requirements: ['5 checks'],
                totalAim: 5,
                currentProgress: routeConfirmations // Reusing routeConfirmations for checker
            },
            {
                id: 'report_helper',
                title: 'report helper',
                description: 'Report incorrect fares or routes 20 times to help improve transport information.',
                requirements: ['20 reports'],
                totalAim: 20,
                currentProgress: reports
            },
            {
                id: 'mapper',
                title: 'local mapper',
                description: 'Add or improve 10 routes or stops within the same areas to unlock this badge.',
                requirements: ['10 locations'],
                totalAim: 10,
                currentProgress: fareSubmissions // Simplified for MVP
            },
            {
                id: 'guardian',
                title: 'route guardian',
                description: 'Consistently update and maintain routes to unlock this badge.',
                requirements: ['15 verifications'],
                totalAim: 15,
                currentProgress: routeConfirmations
            },
            {
                id: 'danfo',
                title: 'danfo master',
                description: 'Submit more Danfo fares than other contributors to unlock this badge.',
                requirements: ['15 danfo fares'],
                totalAim: 15,
                currentProgress: danfoFares
            },
            {
                id: 'keke',
                title: 'keke master',
                description: 'Submit more Keke fares than other contributors to unlock this badge.',
                requirements: ['15 keke fares'],
                totalAim: 15,
                currentProgress: kekeFares
            },
        ];

        const badgesWithStatus = allBadges.map(badge => ({
            ...badge,
            earned: earnedBadges.includes(badge.id) || (badge.currentProgress >= badge.totalAim)
        }));

        res.status(200).json(badgesWithStatus);
    } catch (error) {
        console.error("Error fetching badges:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const getLeaderboard = async (req, res) => {
    try {
        // Find top 10 users by points
        const topRewards = await rewardModel.find()
            .sort({ userPoint: -1 })
            .limit(10)
            .populate({
                path: 'userId',
                select: 'userName firstName lastName profilePhoto privacy'
            });

        const leaderboard = topRewards.map((reward, index) => {
            const user = reward.userId;
            const privacy = user?.privacy || { contributionVisibility: 'everyone' };
            const visibility = privacy.contributionVisibility;

            let displayName = user?.userName || 'Anonymous';
            let displayPhoto = user?.profilePhoto;

            if (visibility === 'community') {
                displayName = 'Trusted Contributor';
                displayPhoto = null; // Hide photo for anonymous
            } else if (visibility === 'private') {
                displayName = 'Private Contributor';
                displayPhoto = null;
            }

            return {
                id: reward._id,
                rank: index + 1,
                username: displayName,
                profilePhoto: displayPhoto,
                points: reward.userPoint,
                helped: reward.helpedCount || 0,
                title: visibility === 'private' ? 'Private contributor' : (reward.trustLevel + ' Contributor'),
                description: `Ranked #${index + 1} with ${reward.userPoint} points`,
                count: `${reward.helpedCount || 0} fares`
            };
        });

        res.status(200).json(leaderboard);
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getAchievements,
    getBadges,
    getLeaderboard
};
