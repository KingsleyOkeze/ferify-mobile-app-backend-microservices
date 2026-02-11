const dataExportModel = require("../models/dataExportModel");
const cloudinary = require('cloudinary').v2;

/**
 * Cleanup expired data exports
 * This should be run as a scheduled job (e.g., daily via cron)
 */
const cleanupExpiredExports = async () => {
    try {
        console.log('[CLEANUP] Starting expired exports cleanup...');

        // Find all expired exports
        const expiredExports = await dataExportModel.find({
            status: 'completed',
            expiresAt: { $lt: new Date() }
        });

        if (expiredExports.length === 0) {
            console.log('[CLEANUP] No expired exports found');
            return;
        }

        console.log(`[CLEANUP] Found ${expiredExports.length} expired exports`);

        let successCount = 0;
        let failCount = 0;

        for (const exportJob of expiredExports) {
            try {
                // Extract public_id from Cloudinary URL
                // URL format: https://res.cloudinary.com/{cloud_name}/raw/private/v{version}/{folder}/{public_id}.{format}
                const urlParts = exportJob.fileUrl.split('/');
                const fileNameWithExt = urlParts[urlParts.length - 1];
                const publicId = `ferify/data_exports/${fileNameWithExt.replace('.json', '')}`;

                // Delete from Cloudinary
                await cloudinary.uploader.destroy(publicId, {
                    resource_type: 'raw',
                    type: 'private'
                });

                // Delete from database
                await dataExportModel.findByIdAndDelete(exportJob._id);

                successCount++;
                console.log(`[CLEANUP] Deleted export ${exportJob._id} for user ${exportJob.userId}`);

            } catch (error) {
                failCount++;
                console.error(`[CLEANUP] Failed to delete export ${exportJob._id}:`, error.message);
            }
        }

        console.log(`[CLEANUP] Cleanup complete. Success: ${successCount}, Failed: ${failCount}`);

    } catch (error) {
        console.error('[CLEANUP] Cleanup job failed:', error);
    }
};

/**
 * Manual cleanup endpoint (for testing or admin use)
 */
const triggerCleanup = async (req, res) => {
    try {
        await cleanupExpiredExports();
        res.status(200).json({ message: "Cleanup completed successfully" });
    } catch (error) {
        console.error("Manual cleanup error:", error);
        res.status(500).json({ error: "Cleanup failed" });
    }
};

module.exports = {
    cleanupExpiredExports,
    triggerCleanup
};
