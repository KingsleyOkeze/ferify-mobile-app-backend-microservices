const cron = require('node-cron');
const { cleanupExpiredExports } = require('../utils/cleanupExports');

/**
 * Initialize all scheduled jobs
 */
const initializeJobs = () => {
    // Schedule cleanup job to run daily at 2 AM
    cron.schedule('0 2 * * *', () => {
        console.log('[CRON] Running scheduled cleanup of expired data exports...');
        cleanupExpiredExports();
    });

    console.log('[CRON] Scheduled daily cleanup job at 2:00 AM');
};

module.exports = { initializeJobs };
