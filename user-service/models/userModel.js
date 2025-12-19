const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
	{
		firstName: {
			type: String,
			required: true,
		},
		lastName: {
			type: String,
			required: true,
		},
		userName: {
			type: String,
		},
		email: {
			type: String,
			required: true,
		},
		phoneNumber: {
			type: String,
		},
		password: {
			type: String,
			required: true,
		},
		location: {
			type: String,
		},
		role: {
            type: String,
            required: true,
            enum: ["Admin"], // Only these two roles
            default: "Admin", // Default to "Admin" if no role is provided
        },
		linkedAccount: {
			type: [String],
			enum: ["Google", "Apple"]
		},
		deactivateAccount: {
			type: Boolean,
			default: false
		},
		verificationToken: {
			type: String,
		},
		isEmailVerified: {
			type: Boolean,
			default: false,
		},
		resetPasswordOtp: {
			type: String, // Store OTP as a string for flexibility
			default: null,
		},
		otpExpiration: {
			type: Date, // To track when the OTP will expire
			default: null,
		},
	},
	{ timestamps: true }
);

const userModel = mongoose.model('users', userSchema);

module.exports = userModel;