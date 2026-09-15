const { Resend } = require('resend'); // Or 'nodemailer' / '@sendgrid/mail'

const resend = new Resend(process.env.RESEND_API_KEY);

const isDev = process.env.ENVIRONMENT_VERSION === 'dev';

const frontendURL = process.env.ENVIRONMENT_VERSION === 'dev'
    ? process.env.DEV_FRONTEND_URL
    : process.env.PROD_FRONTEND_URL;

/**
 * Generate email subjects and HTML layouts based on template type
 */
function getEmailTemplate(template, payload) {
    switch (template) {
        case 'verification': {
            const link = `${frontendURL}/verify-email?token=${payload.token}`;
            return {
                subject: 'Verify Your Email Address',
                html: `
                    <h2>Welcome to Our Platform!</h2>
                    <p>Please click the button below to verify your email account:</p>
                    <a href="${link}" style="display:inline-block;padding:10px 20px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:5px;">Verify Email</a>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p><a href="${link}">${link}</a></p>
                    <p>This link will expire in 24 hours.</p>
                `
            };
        }

        case 'reset-password': {
            const link = `${frontendURL}/reset-password?token=${payload.token}`;
            return {
                subject: 'Reset Your Password',
                html: `
                    <h2>Password Reset Request</h2>
                    <p>We received a request to reset your password. Click the button below to set a new password:</p>
                    <a href="${link}" style="display:inline-block;padding:10px 20px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:5px;">Reset Password</a>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p><a href="${link}">${link}</a></p>
                    <p>This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
                `
            };
        }

        default:
            throw new Error(`Invalid email template: ${template}`);
    }
}

/**
 * Core sendEmail transport helper
 */
async function sendEmail({ to, template, payload }) {
    try {
        const { subject, html } = getEmailTemplate(template, payload);

        const sender = isDev
            ? 'Acme <onboarding@resend.dev>'
            : 'Acme <no-reply@kontakt.kawaliry.pl>';

        const response = await resend.emails.send({
            from: sender,
            to: [to],
            subject,
            html
        });

        return response;
    } catch (error) {
        console.error(`Failed to send ${template} email to ${to}:`, error);
        throw new Error('Failed to send email execution context.');
    }
}

module.exports = sendEmail;