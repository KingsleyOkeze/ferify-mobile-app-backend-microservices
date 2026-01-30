const mongoose = require('mongoose');

const estimateSchema = new mongoose.Schema({
    origin: { type: String, required: true },      // raw address
    destination: { type: String, required: true }, // raw address
    vehicleType: { type: String, required: true },
    minFare: { type: Number, required: true },
    maxFare: { type: Number, required: true },
    avgFare: { type: Number, required: true },
    reliabilityScore: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Low' },
    contributorCount: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    isVolatile: { type: Boolean, default: false }
}, { timestamps: true });

// Index for quick lookup of estimates
estimateSchema.index({ origin: 1, destination: 1, vehicleType: 1 }, { unique: true });

const estimateModel = mongoose.model('estimate', estimateSchema);

module.exports = estimateModel;