const EMAIL_COOLDOWN_MS = 60 * 1000;      // 60 Seconds
const ONE_HOUR_MS = 60 * 60 * 1000;       // 1 Hour
const MAX_EMAILS_PER_HOUR = 4;

/**
 * Validates whether an email can be sent based on 60s cooldown and 4 emails/hour limit.
 * Cleans up old timestamps older than 1 hour to prevent array bloat.
 */
module.exports.validateEmailLimits = (user) => {
    const now = Date.now();

    // Remove timestamps older than 1 hour
    const recentHistory = (user.emailSentHistory || []).filter(
        timestamp => now - new Date(timestamp).getTime() < ONE_HOUR_MS
    );

    user.emailSentHistory = recentHistory;

    // 1. Check 60-second cooldown rule
    if (recentHistory.length > 0) {
        const lastSent = new Date(recentHistory[recentHistory.length - 1]).getTime();
        const timePassed = now - lastSent;
        if (timePassed < EMAIL_COOLDOWN_MS) {
            const timeRemainingSec = Math.ceil((EMAIL_COOLDOWN_MS - timePassed) / 1000);
            return {
                allowed: false,
                message: `Please wait ${timeRemainingSec} second(s) before requesting another email.`
            };
        }
    }

    // 2. Check 4-emails-per-hour rule
    if (recentHistory.length >= MAX_EMAILS_PER_HOUR) {
        const oldestInWindow = new Date(recentHistory[0]).getTime();
        const minutesRemaining = Math.ceil((ONE_HOUR_MS - (now - oldestInWindow)) / (1000 * 60));
        return {
            allowed: false,
            message: `Hourly email limit reached. Try again in ${minutesRemaining} minute(s).`
        };
    }

    return { allowed: true };
}