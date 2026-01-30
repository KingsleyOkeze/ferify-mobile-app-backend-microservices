const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved'],
        default: 'pending'
    },
    submittedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Index for efficient rate limiting queries
feedbackSchema.index({ userId: 1, submittedAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
