const UserModel = require("../models/userModel");
const otpModel = require("../models/otpModel");
const internalApi = require("../configs/internalApi");
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const updateProfilePhoto = async (req, res) => {
    const userId = req.headers['x-user-id'];

    if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
    }

    try {
        const user = await UserModel.findById(userId);
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

        const user = await UserModel.findByIdAndUpdate(userId, { userName: newUsername }, { new: true });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({ message: "Username updated successfully", username: user.userName });
    } catch (error) {
        console.error("Update username error:", error);
        return res.status(500).json({ error: "Internal server error" });
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

const updateProfile = async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { firstName, lastName, username, phoneNumber, location, bio } = req.body;

    try {
        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (username) updateData.userName = username; // Note: Schema uses userName
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (location) updateData.location = location;
        if (bio) updateData.bio = bio;

        // Check availability if username is changing
        if (username) {
            const existing = await UserModel.findOne({ userName: username, _id: { $ne: userId } });
            if (existing) {
                return res.status(400).json({ error: "Username already in use" });
            }
        }

        const user = await UserModel.findByIdAndUpdate(userId, updateData, { new: true });

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
                profilePhoto: user.profilePhoto
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
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
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

module.exports = {
    // initiateEmailUpdate,
    verifyEmailUpdate,
    updateUsername,
    // initiatePasswordReset,
    verifyPasswordReset,
    updateProfilePhoto,
    updateProfile,
    updateUserLocation
};
