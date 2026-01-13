const userModel = require("../models/userModel");

const getPrivacySettings = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        const user = await userModel.findById(userId).select('privacy');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ privacy: user.privacy });
    } catch (error) {
        console.error("Get privacy settings error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updatePrivacySettings = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { profileVisibility, contributionVisibility, shareLocationData } = req.body;

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Update fields if provided
        if (profileVisibility !== undefined) user.privacy.profileVisibility = profileVisibility;
        if (contributionVisibility !== undefined) user.privacy.contributionVisibility = contributionVisibility;
        if (shareLocationData !== undefined) user.privacy.shareLocationData = shareLocationData;

        await user.save();

        return res.status(200).json({
            message: "Privacy settings updated successfully",
            privacy: user.privacy
        });
    } catch (error) {
        console.error("Update privacy settings error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getPrivacySettings,
    updatePrivacySettings
};
