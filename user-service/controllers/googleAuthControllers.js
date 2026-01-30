const { OAuth2Client } = require('google-auth-library');
const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const {
    jwt_secret,
    accessTokenSecret,
    refreshTokenSecret,
} = require("../configs/configs");

// Initialize Google Client
// You can use any client ID here as the library verifies against the token's audience
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleLoginFunction = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: "Google ID Token is required" });
    }

    console.log("Audience expecting:", [
        process.env.GOOGLE_CLIENT_ID_ANDROID,
        process.env.GOOGLE_CLIENT_ID_IOS,
        process.env.GOOGLE_CLIENT_ID_WEB
    ]);

    console.log("Incoming token:", typeof idToken, idToken?.slice(0, 20));


    try {
        // Verify the ID Token
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: [
                process.env.GOOGLE_CLIENT_ID_ANDROID,
                process.env.GOOGLE_CLIENT_ID_IOS,
                process.env.GOOGLE_CLIENT_ID_WEB
            ],
            // Specify all your client IDs here
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name, email_verified, sub } = payload;

        if (!email_verified) {
            return res.status(400).json({ error: "Google email is not verified" });
        }

        // Check if user exists
        let user = await userModel.findOne({ email });

        if (user) {
            // User exists - update linkedAccount if necessary
            if (!user.linkedAccount || !user.linkedAccount.includes("Google")) {
                if (!user.linkedAccount) user.linkedAccount = [];
                user.linkedAccount.push("Google");
                await user.save();
            }
        } else {
            // User does not exist - Create new user
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 12);

            user = await userModel.create({
                firstName: given_name || "User",
                lastName: family_name || "",
                email: email,
                password: hashedPassword, // Placeholder secure password
                isEmailVerified: true,
                role: "User",
                linkedAccount: ["Google"],
            });
        }

        // Generate Tokens
        const accessToken = jwt.sign(
            {
                userId: user._id,
                role: user.role,
            },
            accessTokenSecret,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            {
                userId: user._id,
                role: user.role,
            },
            refreshTokenSecret,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            message: "Google login successful",
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                username: user.userName,
                profilePhoto: user.profilePhoto,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Google Login Error:", error);
        return res.status(401).json({ error: "Invalid Google Token" });
    }
};

module.exports = {
    googleLoginFunction
};
