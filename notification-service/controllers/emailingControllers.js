const emailingFunction = require("../helpers/emailingFunction");
const otpEmailTemplate = require("../templates/otpEmailTemplate");

const sendOtpEmailFunction = async (req, res) => {
    const { normalizedEmail, firstName, lastName, otp } = req.query;
    try {
        const { subject, html } = otpEmailTemplate(firstName, lastName, otp);
        await emailingFunction(
            normalizedEmail,
            subject,
            html
        );
        return res.status(200).json({ message: "OTP email sent successfully" });

    } catch (error) {
        console.log("Error sending otp email", error)
        return res.status(500).json({ error: "Internal Server Error!" })
    }

};

module.exports = { sendOtpEmailFunction };