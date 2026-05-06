const express = require('express');
const router = express.Router();
const passport = require('passport');
const {isLoggedIn} = require('../middleware');
const users = require('../controllers/users');
const User = require('../models/user');

router.route('/login')
    .get(users.renderLogin)
    .post(passport.authenticate('local', {failureMessage: 'Logging in unsuccessful'}), users.login)

router.get('/logout', users.logout)

router.route('/users/:id')
    .delete(isLoggedIn, isOwner, users.deleteUser)

module.exports = router;

async function isOwner(req, res, next) {
    let isOwner = false;
    try {
        const foundUser = await User.findById(req.params.id);
        isOwner = foundUser && foundUser._id.equals(req.user._id) ? true : false;
        if(isOwner) {
            next();
        } else {
            return res.json({'error': 'You are not the owner of this profile'});
        }
    } catch (e) {
        return res.json({'error': "We can't find this profile"});
    }
}