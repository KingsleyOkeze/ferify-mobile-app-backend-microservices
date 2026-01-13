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
const client = redis.createClient();
client.connect({
    url: 'redis://username:password@host:port' // Use your cloud provider URL
})
    .then(() => console.log("Connected to Redis"))
    .catch(err => console.error("Redis connection error:", err));



const signupStartFunction = async (req, res) => {
    const { firstName, lastName, email } = req.body;

    try {
        // Validate all required fields
        if (!firstName || !lastName || !email) {
            return res.status(400).json({ error: 'All fields are required!' });
        }

        // Validate firstName and lastName (non-empty after trim)
        if (firstName.trim().length === 0) {
            return res.status(400).json({ error: 'First name is required.' });
        }
        if (lastName.trim().length === 0) {
            return res.status(400).json({ error: 'Last name is required.' });
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
            emailVerified: true
        });
        if (existing) {
            return res.status(400).json({ error: "Email already in use" });
        }

        // Generate OTP
        const otp = generateSixDigitOTP();
        const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

        // Upsert pending user (update if exists, create if not)
        await userModel.findOneAndUpdate(
            { email: normalizedEmail },
            {
                firstName,
                lastName,
                role: 'User',
                email: normalizedEmail,
                emailVerified: false,
            },
            { upsert: true, new: true }
        );

        // Store otp for the user in Redis 
        await redis.setex(`otp:${normalizedEmail}`, otpExpiresAt, otp);

        // Send OTP email (with no await).
        try {
            internalApi.get(
                `${process.env.NOTIFICATION_SERVICE_URL}/notification/email`,
                {
                    params: {
                        normalizedEmail, firstName, lastName, otp
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

        return res.json({
            message: "OTP sent to email",
            maskedEmail: maskEmail(normalizedEmail) // e.g., o**@gmail.com
        });

    } catch (error) {
        return res.status(500).json({ error: "Internal Server Error!" });
    }
};


const signupVerifyOtpFunction = async (req, res) => {
    const { email, code } = req.body;
    const normalizedEmail = email.trim();

    // Check Redis first
    const redisOtp = await redis.get(`otp:${normalizedEmail}`);
    if (!redisOtp || redisOtp !== code) {
        return res.status(400).json({ error: "Invalid or expired code" });
    }

    const user = await userModel.findOne({ email: normalizedEmail });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    // Mark email as verified, clear OTP
    user.emailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpiresAt = null;
    await user.save();

    // Delete from Redis
    await redis.del(`otp:${normalizedEmail}`);

    // Return success → mobile app now shows password screen
    return res.json({
        message: "Email verified successfully",
        nextStep: "set_password",
        user: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
        }
    });
};


const signupCompleteFunction = async (req, res) => {
    const { email, confirmPassword } = req.body;
    const normalizedEmail = email.trim();

    if (!confirmPassword) {
        return res.status(400).json({ error: "Invalid password" });
    }

    const user = await userModel.findOne({
        email: normalizedEmail,
        emailVerified: true
    });

    if (!user) {
        return res.status(400).json({ error: "Invalid or incomplete registration" });
    }

    if (user.password) {
        return res.status(400).json({ error: "Account already completed" });
    }

    // Now hash and save password
    user.password = await bcrypt.hash(confirmPassword, 12);
    await user.save();

    // Generate tokens
    const accessToken = jwt.sign(
        {
            userId: user._id,
            role: user.role,
        },
        process.env.JWT_SECRET,
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

    return res.json({
        message: "Account created successfully",
        accessToken,
        refreshToken,
        user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
        }
    });
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
            emailVerified: true
        });
        if (existing) {
            return res.status(400).json({ error: "Email already in use" });
        }

        // Generate OTP
        const otp = generateSixDigitOTP();
        const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

        // Store otp for the user in Redis 
        await redis.setex(`otp:${normalizedEmail}`, otpExpiresAt, otp);

        // Send OTP email (with no await).
        try {
            const user = await userModel.findOne({ email: normalizedEmail });

            internalApi.get(
                `${process.env.NOTIFICATION_SERVICE_URL}/notification/email`,
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



const loginFunction = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email & password is required!' });
        }

        // Validate email
        const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValidEmail(email)) {
            console.log('Invalid email');
            return res.status(400).json({ error: 'Invalid email format!' });
        }

        // Normalize email
        const normalizedEmail = email.trim();

        const user = await userModel.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ error: 'Account does not exist!' });
        }

        const normalizedPassword = password.trim();
        const isPasswordValid = bcrypt.compareSync(normalizedPassword, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        if (user.isEmailVerified !== true) {
            console.log('email not verified');
            // Generate OTP
            const otp = generateSixDigitOTP();
            const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

            // Store otp for the user in Redis 
            await redis.setex(`otp:${normalizedEmail}`, otpExpiresAt, otp);

            // Send OTP email
            try {
                internalApi.get(
                    `${process.env.NOTIFICATION_SERVICE_URL}/notification/email`,
                    {
                        params: {
                            normalizedEmail,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            otp
                        },
                        timeout: 50000 // 10 seconds 
                    }
                )

            } catch (error) {
                console.error('OTP email failed (non-blocking):', {
                    email: normalizedEmail,
                    error: error.message,
                    code: error.code,
                    response: error.response?.data
                });
            }

            return res.status(403).json({
                error: 'Email is not verified!',
                redirectUrl: `${process.env.CUSTOMER_CLIENT_URL}/email-sent/${user._id}`,
                userId: user._id,
                role: user.role,
                message: 'Verification code sent to your email'
            });

        }

        // Sign JWT tokens
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

        console.log('successfully logged in.');

        return res
            .status(200)
            .json({
                accessToken,
                refreshToken,
                message: 'Customer logged in successfully',
                user: {
                    userId: user._id,
                    role: user.role
                },
            });

    } catch (error) {
        console.log("Error logging in", error);
        return res.status(500).json({ error: 'Internal Server Error' });
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
        const otp = generateSixDigitOTP();
        const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

        // Store otp for the user in Redis 
        await client.setEx(`otp:${email}`, 600, otp);

        // Send OTP email
        try {
            internalApi.get(
                `${process.env.NOTIFICATION_SERVICE_URL}/notification/email`,
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
        const blacklisted = await redis.get(`blacklist:${refreshToken}`);
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
                    // key     = the token string (unique ID)
                    // ttl     = how long it would have lived
                    // value   = '1' → just a flag saying "dead"
                    await redis.setex(`blacklist:${refreshToken}`, expiresIn, '1');
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



module.exports = {
    loginFunction,
    signupStartFunction,
    signupVerifyOtpFunction,
    signupCompleteFunction,
    resendOtpFunction,
    forgotPasswordFunction,
    resetPasswordFunction,
    refreshTokenFunction,
    logoutFunction
}