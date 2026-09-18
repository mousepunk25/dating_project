const express = require('express');
const router = express.Router();
const { isLoggedIn, emailIpRateLimiter } = require('../middleware');
const users = require('../controllers/users');
const User = require('../models/user');

router.route('/login')
    .get(users.renderLogin)
    .post(users.login);

// Protect registration against mass account creation and initial email spam
router.post('/register', emailIpRateLimiter, users.register);

router.get('/verify-email', users.verifyEmail);

// Protect direct email-dispatch endpoints
router.post('/resend-verification', emailIpRateLimiter, users.resendVerificationEmail);
router.post('/request-password-reset', emailIpRateLimiter, users.requestPasswordReset);

// Password Reset execution
router.post('/reset-password', users.resetPassword);

router.get('/logout', users.logout);

router.route('/users/:id')
    .delete(isLoggedIn, isOwner, users.deleteUser);

module.exports = router;

async function isOwner(req, res, next) {
    let isOwner = false;
    try {
        const foundUser = await User.findById(req.params.id);
        isOwner = foundUser && foundUser._id.equals(req.user._id) ? true : false;
        if (isOwner) {
            next();
        } else {
            return res.json({ 'error': 'You are not the owner of this profile' });
        }
    } catch (e) {
        return res.json({ 'error': "We can't find this profile" });
    }
}