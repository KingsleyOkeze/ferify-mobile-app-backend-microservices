const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
    routeProximity: {
        type: {
            fastestRoute: {
                type: Boolean,
                default: false
            },
            cheapestRoute: {
                type: Boolean,
                default: false
            }
        }
    }
}, { timestamps: true });

const routeModel = mongoose.model("routes", routeSchema);

module.exports = routeModel;