const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Email Transporter Configuration
 * 
 * NOTE: We use port 587 (STARTTLS) instead of the default 465.
 * This is because many free hosting providers (like Koyeb) allow port 587 
 * while blocking others. On Render's free tier, all SMTP ports are blocked, 
 * so it will only work on Koyeb or a paid Render service.
 */
let mailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for port 465, false for port 587
    auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_GMAIL_PASSCODE // Always use a 16-character Google App Password
    },
    tls: {
        rejectUnauthorized: false
    }
});

const emailingFunction = async (sendTo, emailSubject, emailHtml) => {
    try {
        let mailDetails = {
            from: `"Ferify mobile app" <${process.env.ADMIN_EMAIL}>`,
            to: sendTo,
            subject: emailSubject,
            html: emailHtml
        };

        const info = await mailTransporter.sendMail(mailDetails);
        console.log('Email sent successfully:', info.response);
        return { message: 'Email sent successfully' };

    } catch (error) {
        console.error('Error Occurs', error);
        return { message: 'Failed to send email', error };
    }
};



module.exports = emailingFunction;