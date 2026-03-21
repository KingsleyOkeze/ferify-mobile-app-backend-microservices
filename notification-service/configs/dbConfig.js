const mongoose = require('mongoose');

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("NOTIFICATION SERVICE DB CONNECTED");
    } catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    }
}

module.exports = {
    connectDb
}
