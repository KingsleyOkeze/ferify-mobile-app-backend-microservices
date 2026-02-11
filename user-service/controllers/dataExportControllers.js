const userModel = require("../models/userModel");
const dataExportModel = require("../models/dataExportModel");
const rewardModel = require("../models/rewardModel");
const routeModel = require("../models/routeModel");
const feedbackModel = require("../models/feedbackModel");
const internalApi = require("../configs/internalApi");
const fs = require('fs');
const path = require('path');

/**
 * Request a data export
 * Rate limit: 1 export per 24 hours
 */
const requestDataExport = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];

        // Check for existing recent exports (rate limiting)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentExport = await dataExportModel.findOne({
            userId,
            requestedAt: { $gte: twentyFourHoursAgo }
        });

        if (recentExport) {
            return res.status(429).json({
                error: "Rate limit exceeded",
                message: "You can request a data export once every 24 hours",
                existingJobId: recentExport._id
            });
        }

        // Create new export job
        const exportJob = new dataExportModel({
            userId,
            status: 'pending'
        });
        await exportJob.save();

        // Process export asynchronously
        processDataExport(exportJob._id, userId).catch(err => {
            console.error('Background export processing error:', err);
        });

        res.status(202).json({
            message: "Export request received. We'll notify you when it's ready.",
            jobId: exportJob._id,
            status: 'pending'
        });

    } catch (error) {
        console.error("Request data export error:", error);
        res.status(500).json({ error: "Failed to initiate data export" });
    }
};

/**
 * Background processing function
 */
const processDataExport = async (jobId, userId) => {
    let tempFilePath = null;

    try {
        // Update status to processing
        await dataExportModel.findByIdAndUpdate(jobId, { status: 'processing' });

        // Aggregate all user data
        const user = await userModel.findById(userId).lean();
        if (!user) {
            throw new Error("User not found");
        }

        // Get rewards
        const rewards = await rewardModel.findOne({ userId }).lean();

        // Get saved routes
        const savedRoutes = await routeModel.find({ userId }).lean();

        // Get feedback
        const feedback = await feedbackModel.findOne({ userId }).lean();

        // Get contributions from fare-service via internal API
        let contributions = [];
        try {
            const fareResponse = await internalApi.get(`/contributions/user/${userId}`);
            contributions = fareResponse.data || [];
        } catch (err) {
            console.warn('Failed to fetch contributions:', err.message);
        }

        // Build export data
        const exportData = {
            exportDate: new Date().toISOString(),
            userId: userId,
            profile: {
                firstName: user.firstName || null,
                lastName: user.lastName || null,
                username: user.userName || null,
                email: user.email,
                phoneNumber: user.phoneNumber || null,
                profilePhoto: user.profilePhoto || null,
                avatarColor: user.avatarColor || null,
                lastKnownAddress: user.lastKnownAddress || null,
                accountCreated: user.createdAt
            },
            privacy: user.privacy || {
                profileVisibility: 'public',
                contributionVisibility: 'everyone',
                shareLocationData: true
            },
            rewards: rewards ? {
                points: rewards.points || 0,
                level: rewards.level || 1,
                badges: rewards.badges || []
            } : null,
            savedRoutes: savedRoutes.map(route => ({
                from: route.from,
                to: route.to,
                savedAt: route.createdAt
            })),
            contributions: contributions.map(contrib => ({
                origin: contrib.origin?.raw || null,
                destination: contrib.destination?.raw || null,
                vehicleType: contrib.vehicleType,
                fareAmount: contrib.fareAmount,
                timeOfDay: contrib.timeOfDay,
                conditions: contrib.conditions || [],
                timestamp: contrib.timestamp
            })),
            feedback: feedback ? feedback.map(fb => ({
                subject: fb.subject,
                message: fb.message,
                status: fb.status,
                submittedAt: fb.submittedAt
            })) : []
        };

        // Create temporary file
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const fileName = `user_data_${userId}_${Date.now()}.json`;
        tempFilePath = path.join(tempDir, fileName);

        // Write to temporary file
        fs.writeFileSync(tempFilePath, JSON.stringify(exportData, null, 2));

        // Upload to Cloudinary
        const cloudinary = require('cloudinary').v2;
        const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
            folder: "ferify/data_exports",
            public_id: `export_${userId}_${Date.now()}`,
            resource_type: "raw",
            type: "private" // Private file, requires signed URL to access
        });

        // Delete temporary file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        // Calculate expiration (7 days from now)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Update job status with Cloudinary URL
        await dataExportModel.findByIdAndUpdate(jobId, {
            status: 'completed',
            fileUrl: uploadResult.secure_url,
            fileName: fileName,
            expiresAt: expiresAt,
            completedAt: new Date()
        });

        console.log(`Data export completed for user ${userId}, job ${jobId}`);

    } catch (error) {
        console.error(`Data export failed for job ${jobId}:`, error);

        // Clean up temp file on error
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        await dataExportModel.findByIdAndUpdate(jobId, {
            status: 'failed',
            errorMessage: error.message
        });
    }
};

/**
 * Get export job status
 */
const getExportStatus = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { jobId } = req.params;

        const exportJob = await dataExportModel.findOne({ _id: jobId, userId });

        if (!exportJob) {
            return res.status(404).json({ error: "Export job not found" });
        }

        // Check if expired
        if (exportJob.expiresAt && new Date() > exportJob.expiresAt) {
            return res.status(410).json({
                status: 'expired',
                message: "This export has expired. Please request a new one."
            });
        }

        res.status(200).json({
            jobId: exportJob._id,
            status: exportJob.status,
            requestedAt: exportJob.requestedAt,
            completedAt: exportJob.completedAt,
            expiresAt: exportJob.expiresAt,
            downloadUrl: exportJob.status === 'completed' ? `/api/user/account/data-export/download/${jobId}` : null,
            errorMessage: exportJob.errorMessage
        });

    } catch (error) {
        console.error("Get export status error:", error);
        res.status(500).json({ error: "Failed to retrieve export status" });
    }
};

/**
 * Download export file
 */
const downloadExport = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const { jobId } = req.params;

        const exportJob = await dataExportModel.findOne({ _id: jobId, userId });

        if (!exportJob) {
            return res.status(404).json({ error: "Export not found" });
        }

        if (exportJob.status !== 'completed') {
            return res.status(400).json({ error: "Export is not ready for download" });
        }

        // Check if expired
        if (exportJob.expiresAt && new Date() > exportJob.expiresAt) {
            return res.status(410).json({ error: "This export has expired" });
        }

        // Redirect to Cloudinary URL
        res.redirect(exportJob.fileUrl);

    } catch (error) {
        console.error("Download export error:", error);
        res.status(500).json({ error: "Failed to download export" });
    }
};

module.exports = {
    requestDataExport,
    getExportStatus,
    downloadExport
};
