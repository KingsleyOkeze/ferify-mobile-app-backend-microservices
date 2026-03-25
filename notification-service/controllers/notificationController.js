const notificationModel = require('../models/notificationModel');
const { dispatchPushNotification } = require('./pushControllers');
const internalApi = require('../configs/internalApi');

/**
 * Get notification history for a user
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        console.log(`[GET_NOTIFICATIONS] Fetching for userId: ${userId}`);
        if (!userId) return res.status(401).json({ error: "User ID not found in headers" });
        const notifications = await notificationModel.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50);
        console.log(`[GET_NOTIFICATIONS] Found ${notifications.length} notifications`);

        res.status(200).json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

/**
 * Mark all notifications as read for a user
 */
const markAsRead = async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) return res.status(401).json({ error: "User ID not found in headers" });
        await notificationModel.updateMany(
            { userId, isRead: false },
            { $set: { isRead: true } }
        );
        res.status(200).json({ message: 'Notifications marked as read' });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};

/**
 * Handle internal request to create a notification (from other services)
 */
const createInternalNotification = async (req, res) => {
    try {
        const { userId, type, title, description, data } = req.body;
        console.log(`[CREATE_INTERNAL_NOTIF] Received request for userId: ${userId}, type: ${type}`);

        const notification = new notificationModel({
            userId,
            type,
            title,
            description,
            data
        });

        await notification.save();

        // Emit via socket for foreground users
        if (req.io) {
            req.io.to(userId).emit('new_notification', notification);
        }

        // Dispatch Background Push Notification
        // Only if user is NOT actively using the app (handled by mobile app but we send anyway as a fallback)
        // And if the user has enabled notifications for this category
        (async () => {
            try {
                const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:5001';
                // Use direct service route, not gateway route
                const pushDataResponse = await internalApi.get(`${userServiceUrl}/internal/push-data?userId=${userId}`);
                const { pushToken, notificationSettings } = pushDataResponse.data;

                if (pushToken && notificationSettings) {
                    let shouldSend = false;

                    // Map notification type to user settings
                    if (['fare_verified', 'fare_confirmed'].includes(type) && notificationSettings.communityActivity) {
                        shouldSend = true;
                    } else if (type === 'points_earned' && notificationSettings.communityActivity) {
                        shouldSend = true;
                    } else if (type === 'feature_update' && notificationSettings.tipsAndInsight) {
                        shouldSend = true;
                    } else if (type === 'general') {
                        shouldSend = true;
                    }

                    if (shouldSend) {
                        // Calculate unread count for badge
                        const unreadCount = await notificationModel.countDocuments({ userId, isRead: false });
                        console.log(`[Push Badge] Sending badge count: ${unreadCount} for user ${userId}`);

                        await dispatchPushNotification(
                            [pushToken],
                            title,
                            description,
                            { ...data, screen: '/notification/NotificationScreen' },
                            unreadCount
                        );
                    }
                }
            } catch (pushErr) {
                console.error('Background push dispatch failed:', pushErr.message);
            }
        })();

        return res.status(201).json({ notification });
    } catch (error) {
        console.error('Error creating internal notification:', error);
        return res.status(500).json({ error: 'Failed to create notification' });
    }
};


module.exports = {
    getNotifications,
    markAsRead,
    createInternalNotification
}