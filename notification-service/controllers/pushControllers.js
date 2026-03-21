const axios = require('axios');

/**
 * Standalone function to send push notifications via Expo API
 */
const dispatchPushNotification = async (tokens, title, body, data, badge = null) => {
    try {
        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
            console.warn("No valid tokens provided for push dispatch");
            return null;
        }

        const notifications = tokens.map(token => ({
            to: token,
            sound: 'default',
            title,
            body,
            data: data || {},
            badge: badge !== null ? badge : undefined
        }));

        const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
        const response = await axios.post(EXPO_PUSH_URL, notifications, {
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            }
        });

        return response.data;
    } catch (error) {
        console.error("Push dispatch error:", error.response ? error.response.data : error.message);
        throw error;
    }
};

const sendPushNotification = async (req, res) => {
    try {
        const { tokens, title, body, data } = req.body;
        const result = await dispatchPushNotification(tokens, title, body, data);

        res.status(200).json({
            message: "Push notifications sent successfully",
            result
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to send push notifications" });
    }
};

module.exports = {
    sendPushNotification,
    dispatchPushNotification
};
