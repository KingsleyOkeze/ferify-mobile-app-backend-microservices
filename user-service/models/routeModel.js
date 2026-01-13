const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ["home", "work"],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    latitude: {
        type: Number
    },
    longitude: {
        type: Number
    }
}, { timestamps: true });

// Ensure a user can only have one home and one work address
routeSchema.index({ userId: 1, type: 1 }, { unique: true });

const routeModel = mongoose.model("routes", routeSchema);

module.exports = routeModel;