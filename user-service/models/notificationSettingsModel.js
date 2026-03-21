const mongoose = require('mongoose');

const notificationSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        unique: true
    },
    communityActivity: {
        type: Boolean,
        default: false
    },
    tipsAndInsight: {
        type: Boolean,
        default: true
    },
    notificationSound: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const notificationSettingsModel = mongoose.model('notificationsettings', notificationSettingsSchema);

module.exports = notificationSettingsModel;
