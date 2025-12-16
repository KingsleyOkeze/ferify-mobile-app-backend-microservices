require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require('http-proxy-middleware');
const { limiter } = require('./configs/configs');
const { internalSecretHeader } = require("./middlewares/internalSecretHeader")
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*', // Allow all
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    // credentials: true
}));

// Rate Limiting (fixed number of requests per minute per IP)
app.use(limiter);

// Middleware to Inject the Internal Secret Header
app.use(internalSecretHeader);

// Routes
app
    .use("/api/user", createProxyMiddleware({
        target: process.env.USER_SERVICE_URL, // Target URL of the User Service
        changeOrigin: true,
    })
);

app
    .use("/api/fare", createProxyMiddleware({
        target: process.env.FARE_SERVICE_URL, // Target URL of the Fare Service
        changeOrigin: true,
    })
);

app
    .use("/api/route", createProxyMiddleware({
        target: process.env.ROUTES_SERVICE_URL, // Target URL of the Route Service
        changeOrigin: true
    }))
    

app.listen(PORT, () => {
    console.log(`API GATEWAY LISTENING ON PORT ${PORT}`)
})

