const path = require('path');
const User = require('../models/user');
const SonProfile = require('../models/sonProfile');
const ParentProfile = require('../models/parentProfile');
const cloudinary = require('cloudinary').v2;

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

module.exports.register = async (req, res, next) => {
    console.log(req.body);
    try {
        const { email, password, role } = req.body;
        const user = new User({ email, role });
        const registeredUser = await User.register(user, password);
        let profileId = '';
        if (role === 'parent') {
            const parentProfile = new ParentProfile({ owner: registeredUser._id });
            try {
                await parentProfile.save();
                profileId = parentProfile._id;
            } catch (e) {
                console.log(e);
            }
        } else if (role === 'son') {
            let image = {};
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET
            });
            try {
                const uploadResult = await cloudinary.uploader
                .upload(
                    path.join(__dirname, '../public/image_placeholder'), {
                    public_id: 'shoes',
                }
                )
                .catch((error) => {
                    console.log(error);
                });

            image = {
                url: uploadResult.secure_url,
                filename: 'Profile Picture'
            };
            } catch (e) {
                return next(e);
            }
            const sonProfile = new SonProfile({ owner: registeredUser._id, image});
            try {
                await sonProfile.save();
                profileId = sonProfile._id;
            } catch (e) {
                console.log(e);
            }
        }
        req.login(registeredUser, err => {
            if (err) return next(err);
            res.redirect(`http://localhost:3000/myprofile?profileid=${profileId}&role=${role}`);
        })
    } catch (e) {
        console.log(e.message);
        res.redirect('register');
    }
}