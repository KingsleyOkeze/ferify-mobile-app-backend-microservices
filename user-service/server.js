require("dotenv").config();
const express = require('express');
const app = express();
const authRoutes = require("./routes/authRoutes");
const internalSecretKeyCheckMiddleware = require("./middlewares/internalSecretKeyCheck");

const PORT = process.env.PORT || 5001;
app.use(express.json({ limit: '1mb' }));

app.use(internalSecretKeyCheckMiddleware);

app.use('/user/auth', authRoutes);
// app.use('/user/profile')

app.listen(PORT, () => {
    console.log(`USER SERVICE LISTENING ON PORT ${PORT}`)
});




