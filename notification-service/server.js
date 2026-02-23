require("dotenv").config();
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const { connectDb } = require('./configs/dbConfig')
const { initializeSocket } = require('./configs/socketConfig');
const emailRoutes = require("./routes/emailRoutes");
const pushRoutes = require("./routes/pushRoutes");
const historyRoutes = require("./routes/historyRoutes");
const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");

// Socket.io Setup
const io = initializeSocket(server);

// Middleware to inject io into requests
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use((req, res, next) => {
    console.log(`[NOTIFICATION_SERVICE] ${req.method} ${req.url}`);
    console.log(`Headers: ${JSON.stringify(req.headers)}`);
    next();
});

const PORT = process.env.PORT || 5004;

app.use(express.json({ limit: '1mb' }));
app.use(internalSecretKeyCheckMiddleware);

connectDb();

// Routes are applied after io initialization if they need it via req.io
app.use('/notification/email', emailRoutes);
app.use('/notification/push', pushRoutes);
app.use('/user-notification-history', historyRoutes);

server.listen(PORT, () => {
    console.log(`NOTIFICATION SERVICE LISTENING ON PORT ${PORT}`)
});

