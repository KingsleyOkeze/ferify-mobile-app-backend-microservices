require("dotenv").config();
const express = require('express');
const app = express();
const fareRoutes = require("./routes/fareRoutes");


const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");

const { connectDb } = require("./configs/configs");

const PORT = process.env.PORT || 5002;
app.use(express.json({ limit: '1mb' }));

const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Pass io to request
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use(internalSecretKeyCheckMiddleware);

app.use(fareRoutes);

connectDb(server, PORT);
