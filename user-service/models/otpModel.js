const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    email: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
    },
    otp: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['email_update', 'password_reset', 'registration', 'phone_update'],
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    }
}, { timestamps: true });

// Index for automatic deletion after expiry
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('otp', otpSchema);
