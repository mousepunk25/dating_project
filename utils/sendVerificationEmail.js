const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const isDev = process.env.ENVIRONMENT_VERSION === 'dev';

const backendURL = isDev
    ? process.env.DEV_BACKEND_URL
    : process.env.PROD_BACKEND_URL;

const sendVerificationEmail = async (email, unhashedToken) => {
    const confirmUrl = `${backendURL}/verify-email?token=${unhashedToken}`;

    // 1. Resend requires onboarding@resend.dev unless you have a verified domain
    const sender = isDev 
        ? 'Acme <onboarding@resend.dev>' 
        : 'Acme <no-reply@yourdomain.com>';

    // 2. In dev mode, redirect all emails to your personal Resend account address
    const recipient = isDev 
        ? process.env.MY_PERSONAL_EMAIL 
        : email;

    await resend.emails.send({
        from: sender,
        to: recipient,
        subject: isDev ? `[DEV] Verify email for ${email}` : 'Verify your email address',
        html: `
            <h2>Welcome!</h2>
            <p>Please confirm your email address by clicking the link below:</p>
            <p><a href="${confirmUrl}">Verify Email</a></p>
            <p>This link will expire in 24 hours.</p>
        `
    });
};

module.exports = sendVerificationEmail;