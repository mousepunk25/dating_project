const { Resend } = require('resend');
const mongoose = require('mongoose');

// Import modeli Mongoose (dostosuj ścieżki)
const User = require('./models/user');
const ParentProfile = require('./models/parentProfile');
const SonProfile = require('./models/sonProfile');
const Message = require('./models/message');

const resend = new Resend(process.env.RESEND_API_KEY);

function getMessageText(count) {
    if (count === 1) return 'Masz 1 nieprzeczytaną wiadomość.';
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
        return `Masz ${count} nieprzeczytane wiadomości.`;
    }
    return `Masz ${count} nieprzeczytanych wiadomości.`;
}

function getSonFriendText(count) {
    if (count === 1) return 'Masz 1 nowe połączenie w znajomych od kandydata na zięcia.';
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
        return `Masz ${count} nowe połączenia w znajomych od kandydatów na zięciów.`;
    }
    return `Masz ${count} nowych połączeń w znajomych od kandydatów na zięciów.`;
}

function getSonRequestText(count) {
    if (count === 1) return 'Masz 1 nowe zaproszenie do znajomych od kandydata na zięcia.';
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
        return `Masz ${count} nowe zaproszenia do znajomych od kandydatów na zięciów.`;
    }
    return `Masz ${count} nowych zaproszeń do znajomych od kandydatów na zięciów.`;
}

function getParentFriendText(count) {
    if (count === 1) return 'Masz 1 nowe połączenie w znajomych od kandydatki/kandydata na teściową/teścia.';
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
        return `Masz ${count} nowe połączenia w znajomych od kandydatek/kandydatów na teściowe/teściów.`;
    }
    return `Masz ${count} nowych połączeń w znajomych od kandydatek/kandydatów na teściowe/teściów.`;
}

function getParentRequestText(count) {
    if (count === 1) return 'Masz 1 nowe zaproszenie do znajomych od kandydatki/kandydata na teściową/teścia.';
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
        return `Masz ${count} nowe zaproszenia do znajomych od kandydatek/kandydatów na teściowe/teściów.`;
    }
    return `Masz ${count} nowych zaproszeń do znajomych od kandydatek/kandydatów na teściowe/teściów.`;
}

async function sendNotificationEmail(recipientEmail, notifications) {
    const emailBodyList = notifications.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('');

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'Powiadomienia <onboarding@resend.dev>',
            to: [recipientEmail],
            subject: 'Podsumowanie dnia: Masz nowe aktywności na profilu!',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #2c3e50;">Witaj!</h2>
                    <p>Oto Twoje codzienne podsumowanie aktywności w serwisie:</p>
                    <ul style="padding-left: 20px;">
                        ${emailBodyList}
                    </ul>
                    <p style="margin-top: 20px;">Zaloguj się do swojego konta, aby sprawdzić szczegóły i odpowiedzieć.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <small style="color: #777;">To jest wiadomość wygenerowana automatycznie, prosimy na nią nie odpowiadać.</small>
                </div>
            `
        });

        if (error) {
            console.error(`Błąd Resend API dla ${recipientEmail}:`, error);
            return false;
        }

        console.log(`E-mail z powiadomieniem wysłany do ${recipientEmail} (ID: ${data.id})`);
        return true;
    } catch (err) {
        console.error(`Nie udało się wysłać e-maila do ${recipientEmail}:`, err);
        return false;
    }
}

async function run() {
    console.log(`[${new Date().toISOString()}] Łączenie z MongoDB...`);
    
    const mongoURI = `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@datingproject.ktsayaf.mongodb.net/?appName=DatingProject`;

    if (!process.env.DATABASE_USERNAME || !process.env.DATABASE_PASSWORD) {
        throw new Error('Brak zmiennych środowiskowych DATABASE_USERNAME lub DATABASE_PASSWORD!');
    }

    await mongoose.connect(mongoURI);
    console.log('Połączono z bazą danych.');

    let sentEmailsCount = 0;
    let failedEmailsCount = 0;

    try {
        const users = await User.find({ isVerified: true }).lean();

        for (const user of users) {
            const notifications = [];

            // 1. Nieprzeczytane wiadomości
            const unreadMessagesCount = await Message.countDocuments({
                sender: { $ne: user._id },
                readBy: { $ne: user._id }
            });

            if (unreadMessagesCount > 0) {
                notifications.push(getMessageText(unreadMessagesCount));
            }

            // 2. Powiadomienia specyficzne dla roli
            if (user.role === 'parent') {
                const parentProfile = await ParentProfile.findOne({ owner: user._id }).lean();

                if (parentProfile) {
                    const unseenFriendsCount = parentProfile.sonsFriends?.sonsFriendsArray?.filter(
                        f => f.seen === false
                    ).length || 0;

                    if (unseenFriendsCount > 0) {
                        notifications.push(getSonFriendText(unseenFriendsCount));
                    }

                    const unseenRequestsCount = parentProfile.sonsWhoWantToBeAdded?.filter(
                        r => r.seen === false
                    ).length || 0;

                    if (unseenRequestsCount > 0) {
                        notifications.push(getSonRequestText(unseenRequestsCount));
                    }
                }

            } else if (user.role === 'son') {
                const sonProfile = await SonProfile.findOne({ owner: user._id }).lean();

                if (sonProfile) {
                    const unseenFriendsCount = sonProfile.parentsFriends?.parentsFriendsArray?.filter(
                        f => f.seen === false
                    ).length || 0;

                    if (unseenFriendsCount > 0) {
                        notifications.push(getParentFriendText(unseenFriendsCount));
                    }

                    const unseenRequestsCount = sonProfile.parentsWhoWantToBeAdded?.filter(
                        r => r.seen === false
                    ).length || 0;

                    if (unseenRequestsCount > 0) {
                        notifications.push(getParentRequestText(unseenRequestsCount));
                    }
                }
            }

            // 3. Wysyłka e-maila
            if (notifications.length > 0) {
                const isSent = await sendNotificationEmail(user.email, notifications);
                if (isSent) {
                    sentEmailsCount++;
                } else {
                    failedEmailsCount++;
                }
            }
        }

        console.log(`\n--- PODSUMOWANIE WYSYŁKI ---`);
        console.log(`Liczba pomyślnie wysłanych e-maili: ${sentEmailsCount}`);
        if (failedEmailsCount > 0) {
            console.log(`Liczba nieudanych prób: ${failedEmailsCount}`);
        }
        console.log('Zakończono wysyłanie powiadomień.');
    } catch (error) {
        console.error('Błąd podczas wykonywania skryptu:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Rozłączono z bazą danych.');
    }
}

// Uruchomienie skryptu
run();