const jwt = require("jsonwebtoken");
require("dotenv").config();

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;

const userAuth = async (req, res, next) => {

    try {
        console.log(`[AUTH] Checking token for path: ${req.path}`);
        const authHeader = req.header("Authorization");
        const queryToken = req.query.token;

        if (authHeader) console.log('[AUTH] Found Authorization header');
        if (queryToken) console.log('[AUTH] Found Query token');

        if (!authHeader && !queryToken) {
            console.log("[AUTH] No token provided!");
            return res.status(401).json({ error: "No token provided!" });
        }

        const token = authHeader ? authHeader.replace("Bearer ", "") : queryToken;

        const decoded = jwt.verify(token, accessTokenSecret);
        console.log(`[AUTH] Token verified for user: ${decoded.userId}`);

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
