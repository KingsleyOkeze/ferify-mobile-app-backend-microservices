const UserModel = require("../models/userModel");
const otpModel = require("../models/otpModel");
const internalApi = require("../configs/internalApi");

const initiateEmailUpdate = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { newEmail } = req.body;

    if (!newEmail) {
        return res.status(400).json({ error: "New email is required" });
    }

    try {
        // Check if email already exists
        const existingUser = await UserModel.findOne({ email: newEmail });
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use" });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP
        await otpModel.findOneAndUpdate(
            { userId, purpose: 'email_update' },
            { otp, email: newEmail, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
            { upsert: true, new: true }
        );

        // Call Notification Service
        const notificationUrl = `${process.env.NOTIFICATION_SERVICE_URL}/notification/email/send-otp-email`;
        await internalApi.get(notificationUrl, {
            params: {
                normalizedEmail: newEmail,
                firstName: user.firstName || 'User',
                otp: otp
            }
        });

        res.status(200).json({ message: "Verification code sent to your new email" });
    } catch (error) {
        console.error("Error initiating email update:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const verifyEmailUpdate = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { otp } = req.body;

    if (!otp) {
        return res.status(400).json({ error: "OTP is required" });
    }

    try {
        const otpRecord = await otpModel.findOne({ userId, otp, purpose: 'email_update' });

        if (!otpRecord || otpRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        // Update user email
        await UserModel.findByIdAndUpdate(userId, { email: otpRecord.email });

        // Delete OTP
        await otpModel.deleteOne({ _id: otpRecord._id });

        res.status(200).json({ message: "Email updated successfully", newEmail: otpRecord.email });
    } catch (error) {
        console.error("Error verifying email update:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const updateUsername = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { newUsername } = req.body;

    if (!newUsername) {
        return res.status(400).json({ error: "New username is required" });
    }

    try {
        const existingUser = await UserModel.findOne({ username: newUsername });
        if (existingUser) {
            return res.status(400).json({ error: "Username already in use" });
        }

        const user = await UserModel.findByIdAndUpdate(userId, { username: newUsername }, { new: true });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ message: "Username updated successfully", username: user.username });
    } catch (error) {
        console.error("Update username error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const initiatePasswordReset = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await otpModel.findOneAndUpdate(
            { userId, purpose: 'password_reset' },
            { otp, email: user.email, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
            { upsert: true, new: true }
        );

        const notificationUrl = `${process.env.NOTIFICATION_SERVICE_URL}/notification/email/send-otp-email`;
        await internalApi.get(notificationUrl, {
            params: {
                normalizedEmail: user.email,
                firstName: user.firstName || 'User',
                otp: otp
            }
        });

        res.status(200).json({ message: "Verification code sent to your email" });
    } catch (error) {
        console.error("Error initiating password reset:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const verifyPasswordReset = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { otp, newPassword } = req.body;

    if (!otp || !newPassword) {
        return res.status(400).json({ error: "OTP and new password are required" });
    }

    try {
        const otpRecord = await otpModel.findOne({ userId, otp, purpose: 'password_reset' });

        if (!otpRecord || otpRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.password = newPassword; // UserModel should handle hashing via pre-save hook
        await user.save();

        await otpModel.deleteOne({ _id: otpRecord._id });

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Error verifying password reset:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    initiateEmailUpdate,
    verifyEmailUpdate,
    updateUsername,
    initiatePasswordReset,
    verifyPasswordReset
};
