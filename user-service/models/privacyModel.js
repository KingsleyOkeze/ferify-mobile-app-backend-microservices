const mongoose = require('mongoose');

const privacySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        unique: true
    },
    profileVisibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    },
    contributionVisibility: {
        type: String,
        enum: ['everyone', 'community', 'private'],
        default: 'everyone'
    },
    shareLocationData: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const privacyModel = mongoose.model('privacies', privacySchema);

module.exports = privacyModel;
