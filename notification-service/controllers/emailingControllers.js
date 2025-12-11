const emailingFunction = require("../helpers/emailingFunction");

const sendOtpEmailFunction = async (req, res) => {
    const { normalizedEmail, firstName, lastName, otp } = req.query;
    try {
        const { subject, html } = otpEmailTemplate(firstName, lastName, otp);
        await emailingFunction(
            normalizedEmail, 
            subject, 
            html
        );
        
    } catch (error) {
        console.log("Error sending otp email", error)
        return res.status(500).json({ error: "Internal Server Error!"})
    }

};

module.exports = {sendOtpEmailFunction};