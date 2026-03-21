const mongoose = require("mongoose");

const dataExportSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    fileUrl: {
        type: String,
        default: null
    },
    fileName: {
        type: String,
        default: null
    },
    expiresAt: {
        type: Date,
        default: null
    },
    errorMessage: {
        type: String,
        default: null
    },
    requestedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    completedAt: {
        type: Date,
        default: null
    }
});

// Index for cleanup queries
dataExportSchema.index({ expiresAt: 1, status: 1 });

module.exports = mongoose.model("DataExport", dataExportSchema);
