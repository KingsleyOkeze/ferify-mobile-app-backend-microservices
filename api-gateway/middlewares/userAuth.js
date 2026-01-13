const jwt = require("jsonwebtoken");
// const customerModel = require("../models/customerModel");
require("dotenv").config();

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;

const userAuth = async (req, res, next) => {

    try {
        const authHeader = req.header("Authorization");
        console.log('Authorization header:', authHeader);

        if (!authHeader) {
            console.log("No Authorization header found for User!");
            return res.status(401).json({ error: "No token provided!" });
        }

        const token = authHeader.replace("Bearer ", "");
        console.log('Token:', token);

        const decoded = jwt.verify(token, accessTokenSecret);

        if (!decoded || !decoded.userId) {
            return res.status(401).json({ error: "Session token expired or invalid!" });
        }

        console.log('decoded is', decoded)

        const allowedRoles = ["User"];
        if (!allowedRoles.includes(decoded.role)) {
            return res.status(403).json({ error: "Access forbidden: Insufficient permissions!" });
        }

        // Pass user details to downstream services
        req.headers['x-user-id'] = decoded.userId;
        req.headers['x-user-role'] = decoded.role;

        next(); // Continue to the next middleware or route handler
    } catch (error) {
        console.error("Unexpected error during authentication:", error);
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Invalid or expired token!" });
        }

        return res.status(500).json({ error: "Internal server error during authentication!" });

    }
};

module.exports = userAuth;
