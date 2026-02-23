const { Server } = require('socket.io');

let io;

const initializeSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        perMessageDeflate: false
    });

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

    return io;
};

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
