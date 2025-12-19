const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema({
    userPoint: {
        type: Number
    },
    userBadge: {
        
    }
}, { timestamps: true });

const rewardModel = mongoose.model("rewards", rewardSchema);

module.exports = rewardModel;