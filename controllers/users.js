const path = require('path');
const User = require('../models/user');
const SonProfile = require('../models/sonProfile');
const ParentProfile = require('../models/parentProfile');

module.exports.renderLogin = (req, res) => {
    res.sendFile(path.join(__dirname, '../views/login.html'));
}

module.exports.login = async (req, res) => {
    const foundSonProfiles = await SonProfile.find().populate({
        path: 'owner',
        select: '_id'
    }).exec();
    const foundSonProfile = foundSonProfiles.find(fSP => fSP.owner._id.equals(req.user._id));
    let profileId = null;
    let role = null;
    if (foundSonProfile) {
        profileId = foundSonProfile._id;
        role = 'son';
    } else {
        const foundParentProfiles = await ParentProfile.find().populate({
            path: 'owner',
            select: '_id'
        }).exec();
        const foundParentProfile = foundParentProfiles.find(fPP => fPP.owner._id.equals(req.user._id));
        if (foundParentProfile) {
            profileId = foundParentProfile._id;
            role = 'parent';
        }
    }
    res.redirect(`http://localhost:3000/myprofile?profileid=${profileId}&role=${role}`);
}

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('http://localhost:3000/myprofile?logout=true');
    });
}

module.exports.deleteUser = async (req, res) => {
    const foundSonProfiles = await SonProfile.find().populate({
        path: 'owner',
        select: '_id'
    }).exec();
    const foundSonProfile = foundSonProfiles.find(fSP => fSP.owner._id.equals(req.user._id));
    if (foundSonProfile) {
        try {
            await SonProfile.findByIdAndDelete(foundSonProfile._id);
            await User.findByIdAndDelete(req.params.id);
            return res.send('User deleted');
        } catch (e) {
            return res.send('There is some problem on our side');
        }
    }
}