const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

//Socket.io
let io; // Internal variable to hold the instance

const initializeSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Middleware: Authenticate socket connection with JWT
    io.use((socket, next) => {
        // Apply the access token verification when doing upgrade 
        // const token = socket.handshake.auth.token;
        // if (!token) {
        //     return next(new Error('Authentication error!'));
        // }

        // try {
        //     const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        //     socket.userId = decoded.userId; // Attach userId to socket
        //     next();
        // } catch (err) {
        //     next(new Error('Invalid token'));
        // }


        const id = socket.handshake.auth.userId;

        try {
            socket.userId = id; // Attach userId to socket
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);

        // Optional: Join user-specific room for targeted broadcasts
        socket.join(`user_${socket.userId}`);

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);
        });
    });

    return io;
};

// Use a function to retrieve the IO instance safely
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized! Ensure initializeSocket(server) is called first.');
    }
    return io;
};

module.exports = {
    initializeSocket,
    getIO
};