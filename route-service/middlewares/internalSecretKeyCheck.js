// fare-service/middleware/secretCheck.js
require("dotenv").config();

// The service loads the same key from its environment
const TRUSTED_SECRET_KEY = process.env.INTERNAL_SECRET_KEY; 

const internalSecretKeyCheckMiddleware = (req, res, next) => {
    const receivedSecret = req.headers['x-internal-secret'];

    // Check 1: Do we have a secret key configured?
    if (!TRUSTED_SECRET_KEY) {
        console.error("Configuration Error: TRUSTED_SECRET_KEY not set in service.");
        // This is a server problem, not a client problem
        return res.status(500).send("Internal Server Error."); 
    }

    // Check 2: Does the received header match the trusted key?
    if (receivedSecret === TRUSTED_SECRET_KEY) {
        // The request came from the trusted API Gateway. Allow access.
        next();
    } else {
        // Missing or incorrect secret (direct access attempt)
        console.warn(`Access Denied. Invalid or Missing Secret.`);
        return res.status(403).json({ 
            error: "Forbidden", 
            message: "Direct access to this resource is not allowed. Must be routed via API Gateway." 
        });
    }
};

module.exports = internalSecretKeyCheckMiddleware;