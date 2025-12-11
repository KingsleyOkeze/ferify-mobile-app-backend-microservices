const rateLimit = require("express-rate-limit");

// Rate Limiting (100 requests per minute per IP)
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { 
        status: 429,
        error: "Too many requests—try again later." 
    },
});


module.exports = {
    limiter,
}