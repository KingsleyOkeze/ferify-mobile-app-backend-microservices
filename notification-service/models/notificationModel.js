const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['fare_verified', 'fare_confirmed', 'points_earned', 'feature_update', 'general', 'earned_badge'],
        default: 'general'
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    data: {
        type: Object, // Optional extra data (e.g. fareId, pointsAmount)
        default: {}
    }
}, { timestamps: true });

const notificationModel = mongoose.model('notifications', notificationSchema);

module.exports = notificationModel;
