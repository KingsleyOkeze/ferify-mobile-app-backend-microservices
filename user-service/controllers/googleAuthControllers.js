const { OAuth2Client } = require('google-auth-library');
const userModel = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const {
    jwt_secret,
    accessTokenSecret,
    refreshTokenSecret,
} = require("../configs/configs");
// Initialize Settings Models
const privacyModel = require("../models/privacyModel");
const notificationSettingsModel = require("../models/notificationSettingsModel");

// Initialize Google Client
// You can use any client ID here as the library verifies against the token's audience
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


const sendWelcomeEmail = (firstName, lastName, email) => {
    try {
        internalApi.post(
            `${process.env.NOTIFICATION_SERVICE_URL}/notification/email/welcome`,
            {
                normalizedEmail: email.trim(),
                firstName: firstName,
                lastName: lastName,
            }
        );
    } catch (error) {
        console.error('OTP email failed:', error.message);
    }
}

const sendCompletedProfileSetupSuccessEmail = (firstName, lastName, email) => {
    try {
        internalApi.post(
            `${process.env.NOTIFICATION_SERVICE_URL}/notification/email/setup-complete`,
            {
                normalizedEmail: email.trim(),
                firstName: firstName,
                lastName: lastName,
            }
        );
    } catch (error) {
        console.error('OTP email failed:', error.message);
    }
}


const googleLoginFunction = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: "Google ID Token is required" });
    }

    console.log("Audience expecting:", [
        process.env.GOOGLE_CLIENT_ID_ANDROID_DEBUG,
        process.env.GOOGLE_CLIENT_ID_ANDROID_RELEASE,
        process.env.GOOGLE_CLIENT_ID_IOS,
        process.env.GOOGLE_CLIENT_ID_WEB
    ]);

    console.log("Incoming token:", typeof idToken, idToken?.slice(0, 20));


    // Automatically include BOTH debug and release in audience
    const audience = [
        process.env.GOOGLE_CLIENT_ID_WEB,
        process.env.GOOGLE_CLIENT_ID_IOS,
        process.env.GOOGLE_CLIENT_ID_ANDROID_DEBUG,   // Accept debug tokens
        process.env.GOOGLE_CLIENT_ID_ANDROID_RELEASE, // Accept release tokens
    ].filter(Boolean); // Remove any undefined values

    try {
        // Verify the ID Token
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: audience, // Accepts BOTH debug and release!
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name, email_verified, sub, picture } = payload;

        if (!email_verified) {
            return res.status(400).json({ error: "Google email is not verified" });
        }

        // 1. Try to find user by unique Google ID (the 'sub' field)
        let user = await userModel.findOne({ googleId: sub });
        let isNewUser = false;

        if (!user) {
            // 2. If no googleId match, check if email exists from a previous manual signup
            user = await userModel.findOne({ email });
            if (user) {
                // Link the Google ID to the existing email account
                user.googleId = sub;
                if (!user.linkedAccount.includes("Google")) {
                    user.linkedAccount.push("Google");
                }
                await user.save();
            } else {
                // User does not exist - Create new user
                isNewUser = true;
                const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
                const hashedPassword = await bcrypt.hash(randomPassword, 12);

                user = await userModel.create({
                    googleId: sub, // Save the ID for future logins
                    firstName: given_name || "User",
                    lastName: family_name || "",
                    email: email,
                    password: hashedPassword, // Placeholder secure password
                    isEmailVerified: true,
                    role: "User",
                    linkedAccount: ["Google"],
                    profilePhoto: picture,
                });

                await Promise.all([
                    privacyModel.create({ userId: user._id }),
                    notificationSettingsModel.create({ userId: user._id })
                ]);

                user ? sendWelcomeEmail(email, given_name, family_name) : null;
                user ? sendCompletedProfileSetupSuccessEmail(email, given_name, family_name) : null;
            }
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
            isNewUser,
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
