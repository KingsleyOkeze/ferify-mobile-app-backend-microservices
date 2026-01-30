const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');


const jwt_secret = process.env.JWT_SECRET_KEY
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const connectDb = (app, PORT) => {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log("Connected to MongoDB");
            app.listen(PORT, () => {
                console.log(`USER SERVICE LISTENING ON PORT ${PORT}`)
            });
        })
        .catch(err => console.error("MongoDB connection error:", err));
}

const generateOTP = (length) => {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min)).toString();
};

const maskEmail = (email) => {
    const [user, domain] = email.split("@");
    const maskedUser = user.length > 2 ? user.substring(0, 2) + "*".repeat(user.length - 2) : user + "*";
    return `${maskedUser}@${domain}`;
};




module.exports = {
    jwt_secret,
    accessTokenSecret,
    refreshTokenSecret,
    cloudinary,
    connectDb,
    generateOTP,
    maskEmail
}