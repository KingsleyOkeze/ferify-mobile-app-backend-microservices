require("dotenv").config();
const INTERNAL_SECRET_KEY = process.env.INTERNAL_SECRET_KEY;

// Middleware to Inject the Internal Secret Header
const internalSecretHeader = (req, res, next) => {
    if (!INTERNAL_SECRET_KEY) {
        console.error("INTERNAL_SECRET_KEY is not defined in environment!");
        return res.status(500).send("Server configuration error.");
    }
    // Inject the trusted secret into the shared custom header
    req.headers['x-internal-secret'] = INTERNAL_SECRET_KEY;
    next();
};


module.exports = {
    internalSecretHeader
}