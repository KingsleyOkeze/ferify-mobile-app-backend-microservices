require("dotenv").config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const app = express();
const server = http.createServer(app);
const { connectDb } = require('./configs/dbConfig')
const emailRoutes = require("./routes/emailRoutes");
const pushRoutes = require("./routes/pushRoutes");
const historyRoutes = require("./routes/historyRoutes");
const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");

// Socket.io Setup
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware to inject io into requests
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    next();
});

const PORT = process.env.PORT || 5004;

app.use(express.json({ limit: '1mb' }));
app.use(internalSecretKeyCheckMiddleware);

connectDb(server, PORT);

app.use('/notification/email', emailRoutes);
app.use('/notification/push', pushRoutes);
app.use('/user-notification-history', historyRoutes);


// Socket.io Events
io.on('connection', (socket) => {
    console.log('User connected to notification service:', socket.id);

    // Join a room based on userId for targeted notifications
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their notification room`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected from notification service');
    });
});

server.listen(PORT, () => {
    console.log(`NOTIFICATION SERVICE LISTENING ON PORT ${PORT}`)
});

