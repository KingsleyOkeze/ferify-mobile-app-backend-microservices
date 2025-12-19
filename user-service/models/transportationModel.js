const mongoose = require("mongoose");

const transportationSchema = new mongoose.Schema({
    preferredTransportation: {
        type: {
            Bus: {
                type: Boolean,
                default: false
            },
            Tricycle: {
                type: Boolean,
                default: false
            },
            Motorbike: {
                type: Boolean,
                default: false
            }
        },
        enum: ["Bus", "Tricycle", "Motorbike"]
    }
}, { timestamps: true });

const transportModel = mongoose.model("transportations", transportationSchema);

module.exports = transportModel;