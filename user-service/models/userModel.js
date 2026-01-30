const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
	{
		firstName: {
			type: String,
		},
		lastName: {
			type: String,
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
		profilePhoto: {
			type: String,
		},
		avatarColor: {
			type: String,
		},
		location: { // The Technical Coordinates (Eg: Format: { type: "Point", coordinates: [longitude, latitude] })
			type: {
				type: String,
				enum: ['Point'],
				default: 'Point'
			},
			coordinates: {
				type: [Number], // [longitude, latitude]
				default: [0, 0]
			}
		},
		lastKnownAddress: { // The Human Address (Eg: Format: "123 Fake Street, Ikeja, Lagos")
			type: String,
		},
		role: {
			type: String,
			required: true,
			enum: ["User", "Admin"], // Only these two roles
			default: "User", // Default to "User" if no role is provided
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
		privacy: {
			profileVisibility: {
				type: String,
				enum: ['public', 'private'],
				default: 'public'
			},
			contributionVisibility: {
				type: String,
				enum: ['everyone', 'community', 'private'],
				default: 'everyone'
			},
			shareLocationData: {
				type: Boolean,
				default: true
			}
		}
	},
	{ timestamps: true }
);

const userModel = mongoose.model('users', userSchema);

module.exports = userModel;