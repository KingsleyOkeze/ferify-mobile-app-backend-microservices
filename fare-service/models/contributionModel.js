const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    origin: {
        raw: {
            type: String,
            required: true
        }, // The address string
        placeId: {
            type: String
        }              // Google Place ID if available
    },
    destination: {
        raw: {
            type: String,
            required: true
        },
        placeId: {
            type: String
        }
    },
    vehicleType: {
        type: String,
        required: true,
        enum: ['bus', 'keke', 'bike']
    },
    fareAmount: {
        type: Number,
        required: true
    },
    timeOfDay: {
        type: String,
        required: true,
        enum: ['morning', 'afternoon', 'evening', 'night']
    },
    conditions: {
        type: [String],
        default: []
    }, // e.g., ['rainy', 'traffic']
    notes: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    userReputation: {
        type: Number,
        default: 0
    }, // Snapshot of user reputation at the time of contribution
    isFlagged: {
        type: Boolean,
        default: false
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isLive: {
        type: Boolean,
        default: false
    },
    accuracyMetadata: {
        distanceToOrigin: Number, // In meters
        tripLength: Number       // In meters
    }
}, { timestamps: true });

// Geospatial index for nearby queries
contributionSchema.index({ location: '2dsphere' });


// Index for efficient searching of recent fares on a specific route
contributionSchema.index({ 'origin.raw': 1, 'destination.raw': 1, vehicleType: 1, timestamp: -1 });

const contributionModel = mongoose.model('contribution', contributionSchema);

module.exports = contributionModel;