const axios = require('axios');

/**
 * emailingFunction - API-Based Email (Mailjet V3.1)
 * 
 * NOTE: Render's free tier blocks all SMTP ports (587, 465). 
 * We use the Mailjet API which uses standard HTTPS (Port 443).
 * Mailjet is very developer-friendly and allows sending from a verified Gmail 
 * without requiring a custom domain for testing/portfolio projects.
 */
const emailingFunction = async (sendTo, emailSubject, emailHtml) => {
    try {
        const apiKey = process.env.MAILJET_API_KEY;
        const secretKey = process.env.MAILJET_SECRET_KEY;

        if (!apiKey || !secretKey) {
            console.error('[EMAIL] Mailjet API credentials missing in environment variables!');
            return { message: 'Failed to send email: Credentials missing' };
        }

        // Mailjet API V3.1 Payload
        const mailDetails = {
            "Messages": [
                {
                    "From": {
                        "Email": process.env.ADMIN_EMAIL,
                        "Name": "Ferify Team"
                    },
                    "To": [
                        {
                            "Email": sendTo,
                            "Name": "User"
                        }
                    ],
                    "Subject": emailSubject,
                    "HTMLPart": emailHtml
                }
            ]
        };

        console.log(`[EMAIL] Attempting to send email to ${sendTo} via Mailjet API...`);

        // Use Basic Auth: btoa(apiKey:secretKey) or let axios handle it
        const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

        const response = await axios.post('https://api.mailjet.com/v3.1/send', mailDetails, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('[EMAIL] Sent successfully. Mailjet Message ID:', response.data.Messages[0].Status);
        return { message: 'Email sent successfully', response: response.data };

    } catch (error) {
        console.error('[EMAIL] Mailjet Error:', error.response ? error.response.data : error.message);
        return { message: 'Failed to send email', error: error.message };
    }
};

module.exports = emailingFunction;