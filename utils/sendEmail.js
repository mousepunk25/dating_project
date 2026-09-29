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
                subject: 'Zweryfikuj adres email',
                html: `
                    <h2>Witamy na stronie kawaliry.pl</h2>
                    <p>Kliknij w poniższy przycisk, żeby zweryfikować swoje konto email:</p>
                    <a href="${link}" style="display:inline-block;padding:10px 20px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:5px;">Zweryfikuj email</a>
                    <p>Jeżeli przycisk nie działa skopiuj i wklej ten link do przeglądarki:</p>
                    <p><a href="${link}">${link}</a></p>
                    <p>Ten link wygaśnie za 24 godziny.</p>
                `
            };
        }

        case 'reset-password': {
            const link = `${frontendURL}/reset-password?token=${payload.token}`;
            return {
                subject: 'Zresetuj hasło',
                html: `
                    <h2>Zresetuj hasło</h2>
                    <p>Dostaliśmy prośbę o zresetowanie hasła. Kliknij w poniższy przycisk, żeby utworzyć nowe hasło:</p>
                    <a href="${link}" style="display:inline-block;padding:10px 20px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:5px;">Reset Password</a>
                    <p>Jeśli przycisk nie działa, skopiuj i wklej ten link w przeglądarkę:</p>
                    <p><a href="${link}">${link}</a></p>
                    <p>Ten link wygaśnie za 1 godzinę. Jeżeli nie poprosiłeś o zmianę hasła, zignoruj tę wiadomość.</p>
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
            ? 'Kawaliry <onboarding@resend.dev>'
            : 'Kawaliry <no-reply@kontakt.kawaliry.pl>';

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