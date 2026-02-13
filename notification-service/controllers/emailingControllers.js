// controllers/emailController.js
const path = require('path');
const fs = require('fs');
const emailingFunction = require('../helpers/emailingFunction');

// Helper to read and replace template placeholders
async function renderTemplate(templateName, replacements = {}) {
    const templatePath = path.join(__dirname, '../templates', templateName);

    let htmlContent;
    try {
        htmlContent = fs.readFileSync(templatePath, 'utf8');
    } catch (err) {
        console.error(`Error reading template: ${templateName}`, err);
        // Fallback plain HTML
        htmlContent = `<div><h1>Email</h1><p>Your code is: <b>${replacements.otp || 'N/A'}</b></p></div>`;
    }

    // Replace all placeholders
    Object.entries(replacements).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        htmlContent = htmlContent.replace(regex, value || '');
    });

    return htmlContent;
}

// ────────────────────────────────────────────────
// 1. Verify Signup Email
// ────────────────────────────────────────────────
const sendVerifySignupEmail = async (req, res) => {
    const { normalizedEmail, firstName, lastName, otp } = req.query;

    if (!normalizedEmail || !otp) {
        return res.status(400).json({ error: 'Missing required fields: email and otp' });
    }

    try {
        const html = await renderTemplate('verifyEmailSignupTemplate.html', {
            firstName: firstName || 'User',
            lastName: lastName || '',
            otp,
            email: normalizedEmail,
        });

        await emailingFunction(normalizedEmail, 'Verify your email', html);

        return res.status(200).json({ message: 'Verification email sent' });
    } catch (error) {
        console.error('Error sending signup verification email:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};

// ────────────────────────────────────────────────
// 2. Reset Password OTP
// ────────────────────────────────────────────────
const sendResetPasswordEmail = async (req, res) => {
    const { normalizedEmail, firstName, lastName, otp } = req.query;

    if (!normalizedEmail || !otp) {
        return res.status(400).json({ error: 'Missing required fields: email and otp' });
    }

    try {
        const html = await renderTemplate('resetPasswordOtpEmailTemplate.html', {
            firstName: firstName || 'User',
            lastName: lastName || '',
            otp,
            email: normalizedEmail,
        });

        await emailingFunction(normalizedEmail, 'Reset your password', html);

        return res.status(200).json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error('Error sending reset password email:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};

// ────────────────────────────────────────────────
// 3. Welcome Email
// ────────────────────────────────────────────────
const sendWelcomeEmail = async (req, res) => {
    const { normalizedEmail, firstName, lastName } = req.query;

    if (!normalizedEmail) {
        return res.status(400).json({ error: 'Missing required field: email' });
    }

    try {
        const html = await renderTemplate('welcomeEmailTemplate.html', {
            firstName: firstName || 'User',
            lastName: lastName || '',
            email: normalizedEmail,
        });

        await emailingFunction(normalizedEmail, 'Welcome to Ferify', html);

        return res.status(200).json({ message: 'Welcome email sent' });
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};

// ────────────────────────────────────────────────
// 4. Successful Profile Setup
// ────────────────────────────────────────────────
const sendSetupCompleteEmail = async (req, res) => {
    const { normalizedEmail, firstName, lastName } = req.query;

    if (!normalizedEmail) {
        return res.status(400).json({ error: 'Missing required field: email' });
    }

    try {
        const html = await renderTemplate('successfullProfileSetupEmailTemplate.html', {
            firstName: firstName || 'User',
            lastName: lastName || '',
            email: normalizedEmail,
        });

        await emailingFunction(normalizedEmail, 'Account Ready', html);

        return res.status(200).json({ message: 'Setup complete email sent' });
    } catch (error) {
        console.error('Error sending setup complete email:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};

// ────────────────────────────────────────────────
// 5. Login Verification (OTP)
// ────────────────────────────────────────────────
const sendLoginVerificationEmail = async (req, res) => {
    const { normalizedEmail, firstName, lastName, otp } = req.query;

    if (!normalizedEmail || !otp) {
        return res.status(400).json({ error: 'Missing required fields: email and otp' });
    }

    try {
        const html = await renderTemplate('verifyEmailSignupTemplate.html', { // reusing signup template
            firstName: firstName || 'User',
            lastName: lastName || '',
            otp,
            email: normalizedEmail,
        });

        await emailingFunction(normalizedEmail, 'Login Verification', html);

        return res.status(200).json({ message: 'Login verification email sent' });
    } catch (error) {
        console.error('Error sending login verification email:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
};


const sendForgotPasswordEmail = async (req, res) => {
    const { normalizedEmail, firstName, lastName, otp } = req.body;

    if (!normalizedEmail || !otp) {
        return res.status(400).json({
            error: 'Missing required fields: email and otp'
        });
    }

    try {
        const html = await renderTemplate('resetPasswordOtpEmailTemplate.html', {
            firstName: firstName || 'User',
            lastName: lastName || '',
            otp,
            email: normalizedEmail,
        });

        await emailingFunction(
            normalizedEmail,
            'Reset Your Password',
            html
        );

        return res.status(200).json({
            message: 'Forgot password email sent'
        });

    } catch (error) {
        console.error('Error sending forgot password email:', error);
        return res.status(500).json({
            error: 'Failed to send email'
        });
    }
};


const sendResendOtpEmail = async (req, res) => {
    const { normalizedEmail, firstName, lastName, otp } = req.body;

    if (!normalizedEmail || !otp) {
        return res.status(400).json({
            error: 'Missing required fields: email and otp'
        });
    }

    try {
        const html = await renderTemplate('verifyEmailSignupTemplate.html', {
            firstName: firstName || 'User',
            lastName: lastName || '',
            otp,
            email: normalizedEmail,
        });

        await emailingFunction(
            normalizedEmail,
            'Resend OTP',
            html
        );

        return res.status(200).json({
            message: 'OTP resent successfully'
        });

    } catch (error) {
        console.error('Error resending OTP email:', error);
        return res.status(500).json({
            error: 'Failed to resend OTP'
        });
    }
};



module.exports = {
    sendVerifySignupEmail,
    sendResetPasswordEmail,
    sendWelcomeEmail,
    sendSetupCompleteEmail,
    sendLoginVerificationEmail,
    sendForgotPasswordEmail,
    sendResendOtpEmail,
};
