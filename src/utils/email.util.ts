import nodemailer from 'nodemailer';

export const EmailUtil = {
    /**
     * Generates a 6-digit OTP string.
     */
    generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    },

    /**
     * Sends an OTP verification email to the user.
     * @param to - The recipient's email address.
     * @param otp - The 6-digit OTP code to send.
     */
    async sendOTPEmail(to: string, otp: string): Promise<boolean> {
        try {
            // Configure using your SMTP server/service credentials
            // (e.g. Gmail, Mailtrap for dev, SendGrid, etc.)
            const transporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE || 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@yourdomain.com',
                to,
                subject: 'Your Account Verification OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #1f2937; margin: 0;">OTP Verification</h2>
                        </div>
                        <p style="font-size: 16px; color: #4b5563;">Hello,</p>
                        <p style="font-size: 16px; color: #4b5563;">Here is your One-Time Password (OTP) for verification. Please use it within the specified timeframe to complete your request:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5; background-color: #f3f4f6; padding: 12px 24px; border-radius: 8px;">
                                ${otp}
                            </span>
                        </div>
                        <p style="font-size: 14px; color: #6b7280; text-align: center;">This OTP is valid for a short duration. Do not share this code with anyone.</p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #9ca3af; text-align: center;">If you didn't request this code, you can safely ignore this email.</p>
                    </div>
                `,
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`📧 OTP Email sent successfully to ${to}. Message ID: ${info.messageId}`);
            
            return true;
        } catch (error) {
            console.error('❌ Error sending OTP email:', error);
            return false;
        }
    }
};
