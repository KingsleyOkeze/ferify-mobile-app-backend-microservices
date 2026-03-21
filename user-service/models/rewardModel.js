const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        unique: true
    },
    userPoint: {
        type: Number,
        default: 0
    },
    userBadge: {
        type: String,
        default: 'Novice'
    },
    trustScore: {
        type: Number,
        default: 10, // Start with a small base score
        min: 0,
        max: 100
    },
    trustLevel: {
        type: String,
        enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
        default: 'Bronze'
    },
    level: {
        type: Number,
        default: 1
    },
    earnedBadges: {
        type: [String], // Array of badge IDs like ['starter', 'helper']
        default: []
    },
    helpedCount: { // Number of people helped (total contributions)
        type: Number,
        default: 0
    }

}, { timestamps: true });

const rewardModel = mongoose.model("rewards", rewardSchema);

module.exports = rewardModel;