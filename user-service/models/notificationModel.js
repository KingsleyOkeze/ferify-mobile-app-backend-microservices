const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    fareAlert: {
        priceIncreaseAlert: {
            type: Boolean,
            default: false
        },
        overpricingWarning: {
            type: Boolean,
            default: false
        }
    },
    routeAlert: {
        trafficUpdate: {
            type: Boolean,
            default: false
        },
        newRouteAvailable: {
            type: Boolean,
            default: false
        },
        savedRouteUpdate: {
            type: Boolean,
            default: false
        }
    },
    communityAlert: {
        communityFareUpdate: {
            type: Boolean,
            default: false
        },
        pointAndBadgesEarned: {
            type: Boolean,
            default: false
        }
    },
    appAlert: {
        appAnnouncements: {
            type: Boolean,
            default: false
        },
        tipsAndTricks: {
            type: Boolean,
            default: false
        }
    },
    muteApp: {
        DND: {
            type: Boolean,
            default: false
        },
        time: {
            type: [Date]
        }
    }
}, { timestamps: true });

const notificationModel = mongoose.model("notifications", notificationSchema);

module.exports = notificationModel;