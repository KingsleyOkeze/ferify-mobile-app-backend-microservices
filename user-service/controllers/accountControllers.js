const userModel = require("../models/userModel");
const rewardModel = require("../models/rewardModel");
const contributionModel = require("../models/contributionModel");
const privacyModel = require("../models/privacyModel");
const otpModel = require("../models/otpModel");
const internalApi = require("../configs/internalApi");
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const { generateOTP } = require("../configs/configs");


const getProfile = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.userName,
            email: user.email,
            phone: user.phoneNumber,
            profilePhoto: user.profilePhoto,
            avatarColor: user.avatarColor,
            location: user.lastKnownAddress,
            createdAt: user.createdAt
        });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updateProfilePhoto = async (req, res) => {
    const userId = req.headers['x-user-id'];

    if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
    }

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            // Clean up uploaded file if user not found
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: "User not found" });
        }

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "ferify/profile_photos",
            public_id: `user_${userId}_profile`,
            overwrite: true,
            transformation: [{ width: 500, height: 500, crop: "fill" }]
        });

        // Delete local temp file
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        // Save Cloudinary URL
        user.profilePhoto = result.secure_url;
        await user.save();

        return res.status(200).json({
            message: "Profile photo updated successfully",
            profilePhoto: user.profilePhoto
        });

    } catch (error) {
        console.error("Update profile photo error:", error);
        // Clean up temp file on error
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updateUserEmail = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { newEmail } = req.body;

    if (!newEmail) {
        return res.status(400).json({ error: "New email is required" });
    }

    try {
        console.log(`[USER-SERVICE] Dedicated settings email update for userId: ${userId} to newEmail: ${newEmail}`);

        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if email already in use
        const existing = await userModel.findOne({ email: newEmail.toLowerCase() });
        if (existing) {
            if (existing._id.toString() === userId) {
                return res.status(400).json({ error: "This is already your current email." });
            }
            return res.status(400).json({ error: "Email already in use by another account." });
        }

        const otp = generateOTP(4);

        // Save OTP
        await otpModel.findOneAndUpdate(
            { userId, purpose: 'email_update' },
            { email: newEmail, otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
            { upsert: true, new: true }
        );

        // Send OTP via notification service
        internalApi.post(`${process.env.NOTIFICATION_SERVICE_URL}/notification/email/verify-signup`, {
            normalizedEmail: newEmail,
            firstName: user.firstName || 'User',
            lastName: user.lastName || '',
            otp
        }).catch(err => console.error("Email update OTP notification failed:", err.message));

        res.status(200).json({ message: "Verification code sent to your new email." });
    } catch (error) {
        console.error("Error initiating settings email update:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const updateFullName = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
        return res.status(400).json({ error: "First name and last name are required" });
    }

    try {
        const user = await userModel.findByIdAndUpdate(
            userId,
            { firstName, lastName },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            message: "Name updated successfully",
            firstName: user.firstName,
            lastName: user.lastName
        });
    } catch (error) {
        console.error("Update full name error:", error);
        return res.status(500).json({ error: "Internal server error" });
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
        await userModel.findByIdAndUpdate(userId, { email: otpRecord.email });

        // Delete OTP
        await otpModel.deleteOne({ _id: otpRecord._id });

        res.status(200).json({ message: "Email updated successfully", newEmail: otpRecord.email });
    } catch (error) {
        console.error("Error verifying email update:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const updatePhoneNumber = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
    }

    try {
        const user = await userModel.findByIdAndUpdate(userId, { phoneNumber }, { new: true });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            message: "Phone number updated successfully",
            phoneNumber: user.phoneNumber
        });
    } catch (error) {
        console.error("Update phone number error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updateUsername = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { newUsername } = req.body;

    if (!newUsername) {
        return res.status(400).json({ error: "New username is required" });
    }

    try {
        const existingUser = await userModel.findOne({ username: newUsername });
        if (existingUser) {
            return res.status(400).json({ error: "Username already in use" });
        }

        const user = await userModel.findByIdAndUpdate(userId, { userName: newUsername }, { new: true });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ message: "Username updated successfully", username: user.userName });
    } catch (error) {
        console.error("Update username error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const initiatePasswordReset = async (req, res) => {
    const userId = req.headers['x-user-id'];

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const otp = generateOTP(4);

        // Save OTP
        await otpModel.findOneAndUpdate(
            { userId, purpose: 'password_reset' },
            { email: user.email, otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
            { upsert: true, new: true }
        );

        // Send OTP via notification service
        internalApi.post(`${process.env.NOTIFICATION_SERVICE_URL}/notification/email/forgot-password`, {
            normalizedEmail: user.email,
            firstName: user.firstName || 'User',
            lastName: user.lastName || '',
            otp
        }).catch(err => console.error("Password reset OTP notification failed:", err.message));

        res.status(200).json({ message: "Verification code sent to your email." });
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

        const user = await userModel.findById(userId);
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

const updateProfile = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { firstName, lastName, username, phoneNumber, location, bio, avatarColor, profilePhoto } = req.body;

    try {
        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (username) updateData.userName = username; // Note: Schema uses userName
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (location) updateData.location = location;
        if (bio) updateData.bio = bio;
        if (avatarColor) updateData.avatarColor = avatarColor;
        if (profilePhoto === null) updateData.profilePhoto = null;

        // Check availability if username is changing
        if (username) {
            const existing = await userModel.findOne({ userName: username, _id: { $ne: userId } });
            if (existing) {
                return res.status(400).json({ error: "Username already in use" });
            }
        }

        const user = await userModel.findByIdAndUpdate(userId, updateData, { new: true });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            message: "Profile updated successfully",
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.userName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                profilePhoto: user.profilePhoto,
                avatarColor: user.avatarColor
            }
        });

    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updateUserLocation = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { latitude, longitude, address } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: "Coordinates are required" });
    }

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const privacy = await privacyModel.findOne({ userId });

        if (privacy && !privacy.shareLocationData) {
            return res.status(200).json({ message: "Location update skipped due to privacy settings" });
        }

        user.location = {
            type: 'Point',
            coordinates: [longitude, latitude] // MongoDB uses [lng, lat]
        };
        if (address) {
            user.lastKnownAddress = address;
        }

        await user.save();

        return res.status(200).json({ message: "Location updated successfully" });
    } catch (error) {
        console.error("Update location error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const updatePushToken = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { pushToken } = req.body;

    if (!pushToken) {
        return res.status(400).json({ error: "Push token is required" });
    }

    try {
        const user = await userModel.findByIdAndUpdate(userId, { pushToken }, { new: true });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ message: "Push token updated successfully" });
    } catch (error) {
        console.error("Update push token error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getNearbyPushTokens = async (req, res) => {
    try {
        const { lng, lat, radius = 5000 } = req.query;

        if (!lng || !lat) {
            return res.status(400).json({ error: "Coordinates are required" });
        }

        const privacyModel = require("../models/privacyModel");
        const privateUserIds = await privacyModel.find({ shareLocationData: false }).distinct('userId');

        const nearbyUsers = await userModel.find({
            _id: { $nin: privateUserIds },
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(radius)
                }
            },
            pushToken: { $ne: null, $exists: true }
        }).select('pushToken');


        const tokens = [...new Set(nearbyUsers.map(u => u.pushToken).filter(Boolean))];
        res.status(200).json({ tokens });
    } catch (error) {
        console.error("Get nearby push tokens error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const getRouteContributorsTokens = async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds)) {
            return res.status(400).json({ error: "User IDs array required" });
        }

        const notificationSettingsModel = require("../models/notificationSettingsModel");
        const optingInUserIds = await notificationSettingsModel.find({
            userId: { $in: userIds },
            communityActivity: true
        }).distinct('userId');

        const users = await userModel.find({
            _id: { $in: optingInUserIds },
            pushToken: { $ne: null }
        }).select('pushToken');

        const tokens = users.map(u => u.pushToken);
        res.status(200).json({ tokens });
    } catch (error) {
        console.error("Internal route contributors tokens error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * Fetch push token and notification settings for internal use
 */
const getUserPushData = async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const user = await userModel.findById(userId).select('pushToken');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const notificationSettingsModel = require("../models/notificationSettingsModel");
        const settings = await notificationSettingsModel.findOne({ userId });

        res.status(200).json({
            pushToken: user.pushToken,
            notificationSettings: settings || { communityActivity: false, tipsAndInsight: true, notificationSound: true }
        });
    } catch (error) {
        console.error("Internal get user push data error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const deleteAccount = async (req, res) => {
    const userId = req.headers['x-user-id'];

    if (!userId) {
        return res.status(400).json({ error: "Can't identify user." });
    }

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Delete user
        await userModel.findByIdAndDelete(userId);

        // Delete user rewards/achievements
        await rewardModel.findOneAndDelete({ userId });

        // Delete user contribution history
        await contributionModel.deleteMany({ userId });

        // Note: In a production environment, you might want to trigger background jobs
        // to clean up data in other services (fares, routes, notifications, etc.)
        // via a message queue or internal API calls.

        return res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
        console.error("Delete account error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    updateUserEmail,
    updateFullName,
    verifyEmailUpdate,
    updateUsername,
    verifyPasswordReset,
    updateProfilePhoto,
    updateProfile,
    getProfile,
    updatePhoneNumber,
    updateUserLocation,
    deleteAccount,
    initiatePasswordReset,
    updatePushToken,
    getNearbyPushTokens,
    getRouteContributorsTokens,
    getUserPushData
};
