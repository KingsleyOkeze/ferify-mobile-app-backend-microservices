const redisClient = require("../configs/redisClient");

/**
 * Rate limiter middleware using Redis.
 * Prevents users from submitting too many fares in a short period.
 */
const fareSubmissionRateLimiter = async (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId) return next(); // Let controller handle missing userId

        const key = `ratelimit:submission:${userId}`;
        const limit = 5; // 5 submissions per hour
        const windowInSeconds = 3600;

        const current = await redisClient.incr(key);

        if (current === 1) {
            await redisClient.expire(key, windowInSeconds);
        }

        if (current > limit) {
            return res.status(429).json({
                error: "Too many contributions. Please wait an hour before submitting more fares. Accuracy depends on quality, not quantity."
            });
        }

        next();
    } catch (error) {
        console.error("Rate limiter error:", error);
        next(); // Proceed anyway if Redis is down, don't block users
    }
};

module.exports = { fareSubmissionRateLimiter };
