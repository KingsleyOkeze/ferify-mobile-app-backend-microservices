const mongoose = require('mongoose');

const connectDb = (app, PORT) => {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log("Connected to MongoDB for Fare Service");
            app.listen(PORT, () => {
                console.log(`FARE SERVICE LISTENING ON PORT ${PORT}`)
            });
        })
        .catch(err => console.error("MongoDB connection error:", err));
}

module.exports = {
    connectDb
}
