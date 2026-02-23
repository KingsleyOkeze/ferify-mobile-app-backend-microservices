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
        enum: ['fare_submission', 'route_confirmation', 'location_update', 'incorrect_report']
    },
    pointsAwarded: {
        type: Number,
        default: 0
    },
    details: {
        type: mongoose.Schema.Types.Mixed // Metadata like from/to, vehicle, price
    }
}, { timestamps: true });

const contributionModel = mongoose.model("contributions", contributionSchema);

module.exports = contributionModel;
