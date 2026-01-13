const cloudinary = require('cloudinary').v2;

const jwt_secret=process.env.JWT_SECRET_KEY
const accessTokenSecret=process.env.ACCESS_TOKEN_SECRET
const refreshTokenSecret=process.env.REFRESH_TOKEN_SECRET

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
}); 