require("dotenv").config();
const express = require('express');
const app = express();
const routeRoutes = require("./routes/routeRoutes");
const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");

const PORT = process.env.PORT || 5001;
app.use(express.json({ limit: '1mb' }));

app.use(internalSecretKeyCheckMiddleware);

app.use('/', routeRoutes);

app.listen(PORT, () => {
    console.log(`ROUTES SERVICE LISTENING ON PORT ${PORT}`)
});

