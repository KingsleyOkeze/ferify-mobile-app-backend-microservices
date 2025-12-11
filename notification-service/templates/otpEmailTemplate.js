const otpEmailTemplate = (firstName = '', lastName = '', otp) => {
    const fullName = `${firstName} ${lastName}`.trim() || 'there';

    return {
        subject: `Your Ferify verification code: ${otp}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Verify Your Account</title>
            <style>
                body { margin:0; padding:0; background:#f7f7f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .wrapper { max-width: 420px; margin: 30px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 20px; text-align: center; color: white; }
                .header h1 { margin:0; font-size: 28px; font-weight: 700; }
                .content { padding: 40px 32px; text-align: center; color: #333; }
                .greeting { font-size: 18px; margin-bottom: 16px; }
                .text { font-size: 16px; line-height: 1.6; color: #555; margin: 20px 0; }
                .otp { 
                background: #f8f9ff; 
                border: 3px dashed #667eea; 
                border-radius: 16px; 
                padding: 28px 20px; 
                font-size: 36px; 
                font-weight: bold; 
                letter-spacing: 8px; 
                color: #667eea; 
                margin: 32px 0;
                word-break: break-all;
                }
                .footer { background: #f9f9f9; padding: 24px; text-align: center; font-size: 13px; color: #888; }
                .footer a { color: #667eea; text-decoration: none; }
            </style>
            </head>
            <body>
            <div class="wrapper">
                <div class="header">
                <h1>Ferify</h1>
                </div>
                <div class="content">
                <p class="greeting">Hey ${fullName},</p>
                <p class="text">Here’s your verification code. It expires in <strong>10 minutes</strong>.</p>
                <div class="otp">${otp}</div>
                <p class="text">Didn't request this? Just ignore it.</p>
                </div>
                <div class="footer">
                © 2025 Ferify • <a href="mailto:support@ferify.app">Need help?</a>
                </div>
            </div>
            </body>
            </html>
        `.trim()
    };
};

module.exports = otpEmailTemplate;