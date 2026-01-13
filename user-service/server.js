require("dotenv").config();
const express = require('express');
const app = express();
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const routeRoutes = require("./routes/routeRoutes");
const contributionRoutes = require("./routes/contributionRoutes");
const privacyRoutes = require("./routes/privacyRoutes");
const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");

const PORT = process.env.PORT || 5001;
app.use(express.json({ limit: '1mb' }));

app.use(internalSecretKeyCheckMiddleware);

app.use('/user/auth', authRoutes);
app.use('/user/account', accountRoutes);
app.use('/user/route', routeRoutes);
app.use('/user/contribution', contributionRoutes);
app.use('/user/privacy', privacyRoutes);

app.listen(PORT, () => {
    console.log(`USER SERVICE LISTENING ON PORT ${PORT}`)
});




