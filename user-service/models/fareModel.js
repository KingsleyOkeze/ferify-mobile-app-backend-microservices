const mongoose = require("mongoose");

const fareSchema = new mongoose.Schema({
    fareAlert: {
        enableFareAlert: {
            type: Boolean,
            default: false
        },
        notifyWhenFareIs: {
            type: Number
        },
        autoFlagOverpricedFare: {
            type: Boolean,
            default: false
        },
        priceIncreaseAlert: {
            type: Boolean,
            default: false
        },
        overpricingWarning: {
            type: Boolean,
            default: false
        }
    }
}, { timestamps: true });

const fareModel = mongoose.model("fares", fareSchema);

module.exports = fareModel;