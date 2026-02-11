const mongoose = require('mongoose');

const connectDb = (app, PORT) => {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            app.listen(PORT, () => {
                console.log(`NOTIFICATION SERVICE DB CONNECTED ON PORT ${PORT}`)
            });
        })
        .catch(err => console.error("MongoDB connection error:", err));

}

module.exports = {
    connectDb
}
