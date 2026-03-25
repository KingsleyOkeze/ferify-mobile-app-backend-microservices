require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require('http-proxy-middleware');
const { limiter } = require('./configs/configs');
const { internalSecretHeader } = require("./middlewares/internalSecretHeader")
const INTERNAL_SECRET_KEY = process.env.INTERNAL_SECRET_KEY;
const userAuth = require("./middlewares/userAuth");
const jwt = require("jsonwebtoken");
const url = require("url");
const app = express();
const PORT = process.env.PORT || 5000;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

// app.use((req, res, next) => {
//     console.log('--- GATEWAY INBOUND ---');
//     console.log(`Method: ${req.method}`);
//     console.log(`URL: ${req.url}`);
//     console.log(`Path: ${req.path}`);
//     console.log(`Headers: ${JSON.stringify(req.headers)}`);
//     console.log('-----------------------');
//     next();
// });

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

// Root Health Check Route (Used to wake up Render or verify life)
app.get("/", (req, res) => {
    return res.json({
        message: "Ferify Backend is Online",
        timestamp: new Date().toISOString(),
        // version: "1.0.0"
    });
});

// Routes - User Service (Public Auth)
app.use("/api/user/auth", createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/auth': '' }, // Removes "/api/user/auth" from the beginning
    changeOrigin: true,
}));

// Routes - User Service (Private Account)
app.use("/api/user/account", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/account': '' },
    changeOrigin: true,
}));

// Routes - User Service (Private Route)
app.use("/api/user/route", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/route': '' },
    changeOrigin: true,
}));

// Routes - User Service (Private Contribution)
app.use("/api/user/contribution", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/contribution': '' },
    changeOrigin: true,
}));

// Routes - User Service (Private Privacy)
app.use("/api/user/privacy", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/privacy': '' },
    changeOrigin: true,
}));


// Routes - User Service (Notification settings)
app.use("/api/user/notification-settings", userAuth, createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    pathRewrite: { '^/api/user/notification-settings': '' },
    changeOrigin: true,
}));

const fareProxy = createProxyMiddleware({
    target: process.env.FARE_SERVICE_URL,
    pathRewrite: { '^/api/fare': '' },
    changeOrigin: true,
    ws: true,
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[GATEWAY] Proxying ${req.method} ${req.url} to Fare Service`);
    },
    onError: (err, req, res) => {
        console.error('[FARE Proxy Error]', err.message);
    }
});

// Routes - Fare Service (Private)
app.use("/api/fare", userAuth, fareProxy);

const notificationProxy = createProxyMiddleware({
    target: process.env.NOTIFICATION_SERVICE_URL,
    pathRewrite: { '^/api/notification': '' },
    changeOrigin: true,
    ws: true,
    onProxyReqWs: (proxyReq, req, socket, options, head) => {
        console.log(`[WS Proxy] Outbound request path: ${proxyReq.path}`);
        // Inject the internal secret key so the notification service accepts the request
        proxyReq.setHeader('x-internal-secret', INTERNAL_SECRET_KEY);

        if (req.headers['x-user-id']) {
            proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        }
    },
    onError: (err, req, res) => {
        console.error('[WS Proxy Error]', err);
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[GATEWAY] Proxying ${req.method} ${req.url} to Notification Service`);
    },
    logger: console, // Added for debugging
});

// Routes - Notification Service
app.use("/api/notification", userAuth, notificationProxy);

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


const server = app.listen(PORT, () => {
    console.log(`API GATEWAY LISTENING ON PORT ${PORT}`);
});

// Correctly handle WebSocket upgrades for proxied services with manual auth & rewrite
server.on('upgrade', (req, socket, head) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/api/notification')) {
        handleUpgrade(notificationProxy, req, socket, head, /^\/api\/notification/);
    } else if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/api/fare')) {
        handleUpgrade(fareProxy, req, socket, head, /^\/api\/fare/);
    }
});

// Helper to handle WebSocket upgrades with manual auth & rewrite
function handleUpgrade(proxy, req, socket, head, rewriteRegex) {
    const parsedUrl = url.parse(req.url, true);
    console.log(`[WS Upgrade] Handling socket: ${req.url}`);

    // WebSocket Upgrade requests bypass Express middleware, so we must auth manually
    const token = parsedUrl.query.token;
    if (!token) {
        console.log('[WS Upgrade] Access Denied: No token in query string');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    try {
        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
        console.log(`[WS Upgrade] Authenticated user: ${decoded.userId}`);

        // Manually inject headers for downstream services
        req.headers['x-user-id'] = decoded.userId;
        req.headers['x-internal-secret'] = INTERNAL_SECRET_KEY;

        console.log(`[WS Upgrade] Original request URL: ${req.url}`);

        // Apply path rewrite manually
        req.url = req.url.replace(rewriteRegex, '');

        console.log(`[WS Upgrade] Rewritten request URL for downstream: ${req.url}`);

        proxy.upgrade(req, socket, head);
    } catch (err) {
        console.log('[WS Upgrade] Auth Failed:', err.message);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
    }
}
