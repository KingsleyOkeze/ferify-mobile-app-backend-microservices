const userModel = require("../models/userModel");

const getNotificationSettings = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        const user = await userModel.findById(userId).select('notificationSettings');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            settings: user.notificationSettings || {
                communityActivity: false,
                tipsAndInsight: true,
                notificationSound: true
            }
        });
    } catch (error) {
        console.error("Get notification settings error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updateNotificationSettings = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { communityActivity, tipsAndInsight } = req.body;

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.notificationSettings === undefined) {
            user.notificationSettings = {};
        }

        if (communityActivity !== undefined) user.notificationSettings.communityActivity = communityActivity;
        if (tipsAndInsight !== undefined) user.notificationSettings.tipsAndInsight = tipsAndInsight;
        if (req.body.notificationSound !== undefined) user.notificationSettings.notificationSound = req.body.notificationSound;

        await user.save();

        return res.status(200).json({
            message: "Notification settings updated successfully",
            settings: user.notificationSettings
        });
    } catch (error) {
        console.error("Update notification settings error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getNotificationSettings,
    updateNotificationSettings
};
