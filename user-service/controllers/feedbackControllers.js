const feedbackModel = require("../models/feedbackModel");
const contributionModel = require("../models/contributionModel");
const rewardModel = require("../models/rewardModel");

/**
 * Submit user feedback with rate limiting
 * Rate limit: 5 submissions per 24 hours
 */
const submitFeedback = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { subject, message } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ error: "Subject and message are required" });
        }

        if (subject.trim().length === 0 || message.trim().length === 0) {
            return res.status(400).json({ error: "Subject and message cannot be empty" });
        }

        if (subject.length > 200) {
            return res.status(400).json({ error: "Subject is too long (max 200 characters)" });
        }

        if (message.length > 2000) {
            return res.status(400).json({ error: "Message is too long (max 2000 characters)" });
        }

        // Rate limiting: Check submissions in the last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentSubmissions = await feedbackModel.countDocuments({
            userId,
            submittedAt: { $gte: twentyFourHoursAgo }
        });

        if (recentSubmissions >= 5) {
            return res.status(429).json({
                error: "Feedback limit reached",
                message: "You've reached your daily feedback limit. Please try again in 24 hours."
            });
        }

        // Create and save feedback
        const feedback = new feedbackModel({
            userId,
            subject: subject.trim(),
            message: message.trim()
        });

        await feedback.save();

        // Record contribution for Report Helper badge & points
        try {
            await contributionModel.create({
                userId,
                type: 'incorrect_report',
                pointsAwarded: 20,
                details: { subject: subject.trim() }
            });

            await rewardModel.findOneAndUpdate(
                { userId },
                { $inc: { userPoint: 20 } },
                { upsert: true }
            );
        } catch (contributeError) {
            console.error("Failed to record feedback contribution:", contributeError);
        }

        // Calculate remaining submissions
        const remaining = 5 - (recentSubmissions + 1);

        res.status(201).json({
            message: "Thank you for your feedback!",
            remainingSubmissions: remaining
        });

    } catch (error) {
        console.error("Submit feedback error:", error);
        res.status(500).json({ error: "Failed to submit feedback. Please try again." });
    }
};

/**
 * Get user's feedback submission count for the last 24 hours
 */
const getFeedbackQuota = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentSubmissions = await feedbackModel.countDocuments({
            userId,
            submittedAt: { $gte: twentyFourHoursAgo }
        });

        const remaining = Math.max(0, 5 - recentSubmissions);

        res.status(200).json({
            used: recentSubmissions,
            remaining,
            limit: 5,
            resetsIn: remaining === 0 ? "24 hours" : null
        });

    } catch (error) {
        console.error("Get feedback quota error:", error);
        res.status(500).json({ error: "Failed to retrieve feedback quota" });
    }
};

module.exports = {
    submitFeedback,
    getFeedbackQuota
};
