require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require('http-proxy-middleware');
const { limiter } = require('./configs/configs');
const { internalSecretHeader } = require("./middlewares/internalSecretHeader")
const userAuth = require("./middlewares/userAuth");
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

// Routes - User Service (Public Auth)
app.use("/api/user/auth", createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/auth': '/user/auth' },
    changeOrigin: true,
}));

// Routes - User Service (Private Account)
app.use("/api/user/account", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/account': '/user/account' },
    changeOrigin: true,
}));

// Routes - User Service (Private Route)
app.use("/api/user/route", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/route': '/user/route' },
    changeOrigin: true,
}));

// Routes - User Service (Private Contribution)
app.use("/api/user/contribution", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/contribution': '/user/contribution' },
    changeOrigin: true,
}));

// Routes - User Service (Private Privacy)
app.use("/api/user/privacy", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/privacy': '/user/privacy' },
    changeOrigin: true,
}));

// Routes - Fare Service (Private)
app.use("/api/fare", userAuth, createProxyMiddleware({
    target: process.env.FARE_SERVICE_URL,
    pathRewrite: { '^/api/fare': '/fare' },
    changeOrigin: true,
}));

// Routes - Location Service (Private - inside fare-service)
app.use("/api/location", userAuth, createProxyMiddleware({
    target: process.env.FARE_SERVICE_URL,
    pathRewrite: { '^/api/location': '/location' },
    changeOrigin: true,
}));

// Routes - Route Service (Private)
app.use("/api/route", userAuth, createProxyMiddleware({
    target: process.env.ROUTES_SERVICE_URL,
    pathRewrite: { '^/api/route': '/' }, // route-service listens on root
    changeOrigin: true
}));


app.listen(PORT, () => {
    console.log(`API GATEWAY LISTENING ON PORT ${PORT}`)
})

