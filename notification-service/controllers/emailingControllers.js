const emailingFunction = require("../helpers/emailingFunction");
const fs = require('fs');
const path = require('path');

const sendOtpEmailFunction = async (req, res) => {
    const { normalizedEmail, firstName, lastName, otp, type } = req.query;
    console.log(`SEND EMAIL CALLED: Type=${type}, Email=${normalizedEmail}`);

    try {
        let templateName = '';
        let subject = '';
        let htmlContent = '';

        // Determine template and subject based on type
        if (type === 'signup') {
            templateName = 'verifyEmailSignupTemplate.html';
            subject = 'Verify your email';
        } else if (type === 'reset') {
            templateName = 'resetPasswordOtpEmailTemplate.html';
            subject = 'Reset your password';
        } else if (type === 'welcome') {
            templateName = 'welcomeEmailTemplate.html';
            subject = 'Welcome to Ferify';
        } else if (type === 'setup') {
            templateName = 'successfullProfileSetupEmailTemplate.html';
            subject = 'Account Ready';
        } else if (type === 'login') {
            templateName = 'verifyEmailSignupTemplate.html'; // Reusing signup template for login OTP
            subject = 'Login Verification';
        } else {
            // Fallback to signup if type is missing or unknown
            templateName = 'verifyEmailSignupTemplate.html';
            subject = 'Verify your email';
        }

        // Read the HTML file
        const templatePath = path.join(__dirname, '../templates', templateName);

        try {
            htmlContent = fs.readFileSync(templatePath, 'utf8');
        } catch (err) {
            console.error(`Error reading template file: ${templatePath}`, err);
            // Fallback to simple text if template fails (safety net)
            htmlContent = `<div><h1>${subject}</h1><p>Your code is: <b>${otp}</b></p></div>`;
        }

        // Replace placeholders
        if (htmlContent) {
            htmlContent = htmlContent
                .replace(/{{firstName}}/g, firstName || 'User')
                .replace(/{{lastName}}/g, lastName || '')
                .replace(/{{otp}}/g, otp || '')
                .replace(/{{email}}/g, normalizedEmail || '');
        }

        await emailingFunction(
            normalizedEmail,
            subject,
            htmlContent
        );

        console.log('Email service successfully sent to user');
        return res.status(200).json({ message: "Email sent successfully" });

    } catch (error) {
        console.log("Error sending email", error);
        return res.status(500).json({ error: "Internal Server Error!" });
    }
};

module.exports = { sendOtpEmailFunction };