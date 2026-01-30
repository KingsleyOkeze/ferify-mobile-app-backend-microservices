const RewardModel = require("../models/rewardModel");
const UserModel = require("../models/userModel");

const getAchievements = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        let reward = await RewardModel.findOne({ userId });

        if (!reward) {
            // Create a default reward record if it doesn't exist
            reward = await RewardModel.create({ userId });
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
        const reward = await RewardModel.findOne({ userId });
        const earnedBadges = reward ? reward.earnedBadges : [];

        // Definition of all possible badges (could also be in a separate config or DB)
        const allBadges = [
            { id: 'starter', title: 'fare starter', description: 'Submitted your first fare' },
            { id: 'helper', title: 'route helper', description: 'Verified 5 routes' },
            { id: 'dropper', title: 'fare dropper', description: 'Updated 10 prices' },
            { id: 'checker', title: 'fare checker', description: 'Verify or confirm 5 fares or routes' },
            { id: 'report_helper', title: 'report helper', description: 'Report incorrect fares 20 times' },
            { id: 'mapper', title: 'local mapper', description: 'Add or improve 10 routes' },
            { id: 'guardian', title: 'route guardian', description: 'Consistently update and maintain routes' },
            { id: 'danfo', title: 'danfo master', description: 'Submit 15 Danfo fares' },
            { id: 'keke', title: 'keke master', description: 'Submit 15 Keke fares' },
        ];


        const badgesWithStatus = allBadges.map(badge => ({
            ...badge,
            earned: earnedBadges.includes(badge.id)
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
        const topRewards = await RewardModel.find()
            .sort({ userPoint: -1 })
            .limit(10)
            .populate({
                path: 'userId',
                select: 'userName firstName lastName profilePhoto'
            });

        const leaderboard = topRewards.map((reward, index) => ({
            id: reward._id,
            rank: index + 1,
            username: reward.userId?.userName || 'Anonymous',
            points: reward.userPoint,
            helped: reward.helpedCount || 0,
            title: reward.trustLevel + ' Contributor', // e.g., "Silver Contributor"
            description: `Ranked #${index + 1} with ${reward.userPoint} points`,
            count: `${reward.helpedCount || 0} fares`
        }));

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
