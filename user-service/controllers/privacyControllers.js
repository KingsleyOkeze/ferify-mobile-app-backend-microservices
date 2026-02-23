const privacyModel = require("../models/privacyModel");

const getPrivacySettings = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        let privacy = await privacyModel.findOne({ userId });

        // Lazy create if not exists
        if (!privacy) {
            privacy = await privacyModel.create({ userId });
        }

        return res.status(200).json({ privacy });
    } catch (error) {
        console.error("Get privacy settings error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updatePrivacySettings = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { profileVisibility, contributionVisibility, shareLocationData } = req.body;

    try {
        const updateData = {};
        if (profileVisibility !== undefined) updateData.profileVisibility = profileVisibility;
        if (contributionVisibility !== undefined) updateData.contributionVisibility = contributionVisibility;
        if (shareLocationData !== undefined) updateData.shareLocationData = shareLocationData;

        const privacy = await privacyModel.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { new: true, upsert: true }
        );

        return res.status(200).json({
            message: "Privacy settings updated successfully",
            privacy
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
