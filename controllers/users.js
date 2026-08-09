const path = require('path');
const User = require('../models/user');
const SonProfile = require('../models/sonProfile');
const ParentProfile = require('../models/parentProfile');
const cloudinary = require('cloudinary').v2;
const frontendURL = process.env.ENVIRONMENT_VERSION === 'dev' ? process.env.DEV_FRONTEND_URL : process.env.PROD_FRONTEND_URL;

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
    res.redirect(`${frontendURL}/myprofile?profileid=${profileId}&role=${role}`);
}

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect(`${frontendURL}/myprofile?logout=true`);
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
    try {
        const { email, password, role, fullNameParent, jobParent, cityParent, fullNameSon, dateOfBirth, citySon, aboutYou, jobSon, education} = req.body;
        const user = new User({ email, role });
        const registeredUser = await User.register(user, password);
        let profileId = '';
        if (role === 'parent') {
            const parentProfile = new ParentProfile({ owner: registeredUser._id, fullName: fullNameParent, job: jobParent, address: {city: cityParent, country: '', longitude: '', latitude: ''}, sonAgeMin: 18, sonAgeMax: 100});
            try {
                await parentProfile.save();
                profileId = parentProfile._id;
            } catch (e) {
                console.log(e);
            }
        } else if (role === 'son') {
            let image = {};
            // cloudinary.config({
            //     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            //     api_key: process.env.CLOUDINARY_API_KEY,
            //     api_secret: process.env.CLOUDINARY_API_SECRET
            // });
            try {
                // const uploadResult = await cloudinary.uploader
                // .upload(
                //     path.join(__dirname, '../public/image_placeholder'), {
                //     public_id: 'profile_picture',
                // }
                // )
                // .catch((error) => {
                //     console.log(error);
                // });

            image = {
                url: 'https://res.cloudinary.com/gljkxoem/image/upload/v1784026809/shoes.jpg',
                filename: 'Profile Picture'
            };
            } catch (e) {
                return next(e);
            }
            const sonProfile = new SonProfile({ owner: registeredUser._id, image, fullName: fullNameSon, dateOfBirth, address: {city: citySon, country: '', longitude: '', latitude: ''}, aboutYou, job: {position: jobSon, location: {}, companyName: ''}, education: {schoolName: '', educationLevel: education, field: ''}});
            try {
                await sonProfile.save();
                profileId = sonProfile._id;
            } catch (e) {
                console.log(e);
            }
        }
        req.login(registeredUser, err => {
            if (err) return next(err);
            res.redirect(`${frontendURL}/myprofile?profileid=${profileId}&role=${role}`);
        })
    } catch (e) {
        console.log(e.message);
        res.redirect('register');
    }
}