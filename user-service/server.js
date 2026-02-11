require("dotenv").config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const routeRoutes = require("./routes/routeRoutes");
const contributionRoutes = require("./routes/contributionRoutes");
const privacyRoutes = require("./routes/privacyRoutes");
const notificationSettingsRoutes = require("./routes/notificationSettingsRoutes");
const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");
const { connectDb } = require("./configs/configs");
const { initializeJobs } = require("./jobs/scheduler");

const PORT = process.env.PORT || 5001;
app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    next();
});

connectDb(app, PORT);
app.use(express.json({ limit: '1mb' }));
app.use(internalSecretKeyCheckMiddleware);

app.use(authRoutes);
app.use(accountRoutes);
app.use(routeRoutes);
app.use(contributionRoutes);
app.use(privacyRoutes);
app.use(notificationSettingsRoutes);

// Initialize scheduled jobs
initializeJobs();


