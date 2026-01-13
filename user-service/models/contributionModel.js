const mongoose = require("mongoose");

const contributionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['fare_submission', 'route_confirmation', 'location_update']
    },
    pointsAwarded: {
        type: Number,
        default: 0
    },
    details: {
        type: mongoose.Schema.Types.Mixed // Metadata like from/to, vehicle, price
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const contributionModel = mongoose.model("contributions", contributionSchema);

module.exports = contributionModel;
