const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['fare_verified', 'fare_confirmed', 'points_earned', 'feature_update', 'general'],
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
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
