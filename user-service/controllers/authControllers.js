// CUSTOMER AUTH CONTROLLERS
require('dotenv').config();
const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
    jwt_secret,
    accessTokenSecret,
    refreshTokenSecret,
} = require("../configs/configs");
const redis = require("redis");
const internalApi = require("../configs/internalApi");


// Connect to redis
const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});
client.on('error', (err) => console.error('Redis Client Error', err));
client.connect()
    .then(() => console.log("Connected to Redis"))
    .catch(err => console.error("Redis connection error:", err));



const signupStartFunction = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required!' });
        }

        // Validate email
        const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format!' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters!' });
        }

        const normalizedEmail = email.trim();

        // Check availability
        const existing = await userModel.findOne({ email: normalizedEmail });
        if (existing && existing.isEmailVerified) {
            return res.status(400).json({ error: "Email already in use." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Generate OTP
        const otp = generateOTP(4);
        const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

        // Upsert user
        await userModel.findOneAndUpdate(
            { email: normalizedEmail },
            {
                email: normalizedEmail,
                password: hashedPassword,
                isEmailVerified: false,
            },
            { upsert: true, new: true }
        );

        // Store OTP in Redis
        await client.setEx(`otp:${normalizedEmail}`, 600, otp);

        // Send OTP email
        try {
            internalApi.get(
                `${process.env.NOTIFICATION_SERVICE_URL}/notification/email/send-otp-email`,
                {
                    params: {
                        normalizedEmail,
                        firstName: 'User', // Placeholder
                        lastName: '',
                        otp
                    },
                    timeout: 50000
                }
            );
        } catch (error) {
            console.error('OTP email failed:', error.message);
        }

        return res.json({
            message: "OTP sent to email",
            maskedEmail: maskEmail(normalizedEmail)
        });

    } catch (error) {
        console.error("Signup start error:", error);
        return res.status(500).json({ error: "Internal Server Error!" });
    }
};

const signupVerifyOtpFunction = async (req, res) => {
    const { email, code } = req.body;
    const normalizedEmail = email.trim();

    // Check Redis
    const redisOtp = await client.get(`otp:${normalizedEmail}`);
    if (!redisOtp || redisOtp !== code) {
        return res.status(400).json({ error: "Invalid or expired code" });
    }

    const user = await userModel.findOne({ email: normalizedEmail });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    await user.save();

    // Delete OTP
    await client.del(`otp:${normalizedEmail}`);

    // Generate tokens (LOGIN THE USER IMMEDIATELY)
    const accessToken = jwt.sign(
        { userId: user._id, role: user.role },
        accessTokenSecret,
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { userId: user._id, role: user.role },
        refreshTokenSecret,
        { expiresIn: '7d' }
    );

    return res.json({
        message: "Email verified & logged in",
        accessToken,
        refreshToken,
        user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        }
    });
};

// Deprecated or Removed
const signupCompleteFunction = async (req, res) => {
    return res.status(410).json({ error: "Endpoint deprecated. Password set during initiation." });
};


const resendOtpFunction = async (req, res) => {
    const { email } = req.params;

    try {
        if (!email) {
            return res.status(400).json({ error: 'User is missing' });
        }
        // Validate email
        const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValidEmail(email)) {
            console.log('Invalid email');
            return res.status(400).json({ error: 'Invalid email format!' });
        }

        // Normalize email
        const normalizedEmail = email.trim();

        // Prevent reuse of already verified emails
        const existing = await userModel.findOne({
            email: normalizedEmail,
            isEmailVerified: true
        });
        if (existing) {
            return res.status(400).json({ error: "Email already in use" });
        }

        // Generate OTP
        const otp = generateOTP(4);
        const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

        // Store otp for the user in Redis 
        await client.setEx(`otp:${normalizedEmail}`, 600, otp);

        // Send OTP email (with no await).
        try {
            const user = await userModel.findOne({ email: normalizedEmail });

            internalApi.get(
                `${process.env.NOTIFICATION_SERVICE_URL}/notification/email/send-otp-email`,
                {
                    params: {
                        normalizedEmail,
                        firstName: user?.firstName || 'User',
                        lastName: user?.lastName || '',
                        otp
                    },
                    timeout: 50000 // 5 seconds 
                }
            );

        } catch (error) {
            console.error('OTP email failed (non-blocking):', {
                email: normalizedEmail,
                error: error.message,
                code: error.code,
                response: error.response?.data
            });
        }

        // Don't wait for email service response, just send this 200 response to the user,
        // so that instead of showing a loading state on the user ui, which user might think 
        // our app has broken - thus then leave, what we would do is show a (30sec) count down 
        // on user ui for good (ux) so user can go check their email. And if they don't receive 
        // the email, they can always click resend, that way, our app doesn't feel broken.
        return res.status(200).json({ message: 'An otp email was sent to you' });

    } catch (error) {
        console.log('server error while resending otp email', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }

};



const loginInitiateFunction = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ error: 'Email is required!' });
        }

        const normalizedEmail = email.trim();

        // Check if user exists
        const user = await userModel.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ error: 'Account does not exist. Please sign up.' });
        }

        // Generate OTP
        const otp = generateOTP(4);
        const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

        // Store OTP in Redis
        await client.setEx(`otp:${normalizedEmail}`, 600, otp);

        // Send OTP email
        try {
            internalApi.get(
                `${process.env.NOTIFICATION_SERVICE_URL}/notification/email/send-otp-email`,
                {
                    params: {
                        normalizedEmail,
                        firstName: user.firstName || 'User',
                        lastName: user.lastName || '',
                        otp
                    },
                    timeout: 50000
                }
            );
        } catch (error) {
            console.error('Login OTP email failed:', error.message);
        }

        return res.status(200).json({
            message: "OTP sent to email",
            maskedEmail: maskEmail(normalizedEmail)
        });

    } catch (error) {
        console.error("Login initiate error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const loginVerifyFunction = async (req, res) => {
    const { email, code } = req.body;
    const normalizedEmail = email.trim();

    try {
        // Check Redis
        const redisOtp = await client.get(`otp:${normalizedEmail}`);
        if (!redisOtp || redisOtp !== code) {
            return res.status(400).json({ error: "Invalid or expired code" });
        }

        const user = await userModel.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Delete OTP
        await client.del(`otp:${normalizedEmail}`);

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            accessTokenSecret,
            { expiresIn: '15m' }
        );
        const refreshToken = jwt.sign(
            { userId: user._id, role: user.role },
            refreshTokenSecret,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            message: "Logged in successfully",
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.userName,
                profilePhoto: user.profilePhoto
            }
        });

    } catch (error) {
        console.error("Login verify error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};


const forgotPasswordFunction = async (req, res) => {
    const { email } = req.body;

    try {

        // Check if the email exists in the system
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate OTP
        const otp = generateOTP(6);
        const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

        // Store otp for the user in Redis 
        await client.setEx(`otp:${email}`, 600, otp);

        // Send OTP email
        try {
            internalApi.get(
                `${process.env.NOTIFICATION_SERVICE_URL}/notification/email/send-otp-email`,
                {
                    params: {
                        normalizedEmail: email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        otp
                    },
                    timeout: 50000 // 50 seconds 
                }
            )

        } catch (error) {
            console.error('OTP email failed (non-blocking):', {
                email: email,
                error: error.message,
                code: error.code
            });
        }

        return res.status(200).json({ message: 'Password reset link has been sent to your email.' });

    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error!" });
    }

};


const verifyForgotPasswordOtpFunction = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const otpKey = `otp:${email}`;
        const redisOtp = await client.get(otpKey);

        if (!redisOtp || redisOtp !== otp) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Generate a temporary reset token (JWT)
        const resetToken = jwt.sign(
            { email: email, type: 'password_reset' },
            jwt_secret,
            { expiresIn: '15m' }
        );

        // Clear OTP from Redis
        await client.del(otpKey);

        return res.status(200).json({
            message: 'OTP verified successfully',
            token: resetToken
        });

    } catch (error) {
        console.error("Verify forgot password OTP error:", error);
        return res.status(500).json({ error: "Internal Server Error!" });
    }
};

const resetPasswordFunction = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // Verify token
        const decoded = jwt.verify(token, jwt_secret);

        if (!decoded) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        // Find user by email
        const user = await userModel.findOne({ email: decoded.email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({ message: 'Password reset successfully!' });

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error!' });
    }

};



const refreshTokenFunction = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token provided' });
        }

        // Check if token is blacklisted in our cache db before issuing new token.
        const blacklisted = await client.get(`blacklist:${refreshToken}`);
        if (blacklisted) {
            return res.status(401).json({ error: 'Token has been revoked' });
        }

        // Verify token signature
        const decoded = jwt.verify(refreshToken, refreshTokenSecret);

        // Issue new access token
        const newAccessToken = jwt.sign(
            { userId: decoded.userId, role: decoded.role },
            accessTokenSecret,
            { expiresIn: '15m' }
        );

        // Rotate refresh token (optional)
        const newRefreshToken = jwt.sign(
            { userId: decoded.userId, role: decoded.role },
            refreshTokenSecret,
            { expiresIn: '7d' }
        );

        // Return new access token
        return res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken, });

    } catch (error) {
        console.error('Refresh token error:', error.name, error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token has expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
};



// Logout Function
const logoutFunction = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            try {
                const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
                const now = Math.floor(Date.now() / 1000);
                const expiresIn = decoded.exp - now;

                if (expiresIn > 0) {
                    await client.setEx(`blacklist:${refreshToken}`, expiresIn, '1');
                }
            } catch (err) {
                // Token expired or invalid → nothing to blacklist
            }
        }

        console.log("User logged out successfully, cleared cookies:", refreshTokenCookies);
        return res.status(200).json({
            message: "Logged out successfully",
        });
    } catch (error) {
        console.error("Error during logout:", error.name, error.message);
        return res.status(500).json({
            error: "Internal Server Error",
        });
    }
};



const generateOTP = (length) => {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min)).toString();
};

const maskEmail = (email) => {
    const [user, domain] = email.split("@");
    const maskedUser = user.length > 2 ? user.substring(0, 2) + "*".repeat(user.length - 2) : user + "*";
    return `${maskedUser}@${domain}`;
};

module.exports = {
    loginInitiateFunction,
    loginVerifyFunction,
    signupStartFunction,
    signupVerifyOtpFunction,
    signupCompleteFunction,
    resendOtpFunction,
    forgotPasswordFunction,
    resetPasswordFunction,
    refreshTokenFunction,
    logoutFunction
}