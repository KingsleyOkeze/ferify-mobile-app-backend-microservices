require("dotenv").config();
const express = require('express');
const app = express();
const emailRoutes = require("./routes/emailRoutes");
const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");

app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    next();
});

const PORT = process.env.PORT || 5004;

app.use(express.json({ limit: '1mb' }));
app.use(internalSecretKeyCheckMiddleware);

app.use('/notification/email', emailRoutes);

app.listen(PORT, () => {
    console.log(`NOTIFICATION SERVICE LISTENING ON PORT ${PORT}`)
})

