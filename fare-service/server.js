require("dotenv").config();
const express = require('express');
const app = express();
const fareRoutes = require("./routes/fareRoutes");
const locationRoutes = require("./routes/locationRoutes");
const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");

const PORT = process.env.PORT || 5002;
app.use(express.json({ limit: '1mb' }));

app.use(internalSecretKeyCheckMiddleware);

app.use('/fare', fareRoutes);
app.use('/location', locationRoutes);

app.listen(PORT, () => {
    console.log(`FARE SERVICE LISTENING ON PORT ${PORT}`)
})







// Example usage
// getDistance("Yaba, Lagos", "Ikeja, Lagos");
