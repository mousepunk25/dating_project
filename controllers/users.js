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

// Configure Cloudinary once outside the function or at application startup
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports.register = async (req, res, next) => {
    try {
        const {
            email,
            password,
            role,
            fullNameParent,
            jobParent,
            cityParent,
            fullNameSon,
            dateOfBirth,
            citySon,
            aboutYou,
            jobSon,
            educationLevel,
            image: imageInput // optional base64 string or file path from client
        } = req.body;

        const user = new User({ email, role });
        const registeredUser = await User.register(user, password);
        let profileId = '';

        if (role === 'parent') {
            const parentProfile = new ParentProfile({
                owner: registeredUser._id,
                fullName: fullNameParent,
                job: jobParent,
                address: { city: cityParent, country: '', longitude: '', latitude: '' },
                sonAgeMin: 18,
                sonAgeMax: 100
            });
            await parentProfile.save();
            profileId = parentProfile._id;

        } else if (role === 'son') {
            let imageObj = {};
            const placeholderPath = path.join(__dirname, '../public/image_placeholder.jpg');

            try {
                // Determine source to upload
                const sourceToUpload = imageInput || placeholderPath;

                // 1. Upload with Rekognition AI Moderation enabled
                const uploadResult = await cloudinary.uploader.upload(sourceToUpload, {
                    folder: 'profile_pictures',
                    moderation: 'aws_rek' // Triggers Rekognition AI Moderation
                });

                // 2. Check Moderation Status
                let isApproved = true;
                if (uploadResult.moderation && uploadResult.moderation.length > 0) {
                    const moderationStatus = uploadResult.moderation[0].status;
                    if (moderationStatus === 'rejected' || moderationStatus === 'pending') {
                        isApproved = false;
                    }
                }

                if (isApproved) {
                    imageObj = {
                        url: uploadResult.secure_url,
                        filename: uploadResult.public_id
                    };
                } else {
                    // Image failed moderation: Remove flagged upload and upload placeholder
                    await cloudinary.uploader.destroy(uploadResult.public_id);

                    const fallbackUpload = await cloudinary.uploader.upload(placeholderPath, {
                        folder: 'profile_pictures'
                    });

                    imageObj = {
                        url: fallbackUpload.secure_url,
                        filename: fallbackUpload.public_id
                    };
                }
            } catch (e) {
                console.error('Cloudinary upload or moderation failed:', e);

                // Fallback to uploading placeholder if an error occurs during upload
                try {
                    const fallbackUpload = await cloudinary.uploader.upload(placeholderPath, {
                        folder: 'profile_pictures'
                    });
                    imageObj = {
                        url: fallbackUpload.secure_url,
                        filename: fallbackUpload.public_id
                    };
                } catch (fallbackError) {
                    return next(fallbackError);
                }
            }

            const sonProfile = new SonProfile({
                owner: registeredUser._id,
                image: imageObj,
                fullName: fullNameSon,
                dateOfBirth,
                address: { city: citySon },
                aboutYou,
                job: { position: jobSon, companyName: '' },
                education: { educationLevel: educationLevel }
            });

            await sonProfile.save();
            profileId = sonProfile._id;
        }

        req.login(registeredUser, err => {
            if (err) return next(err);
            res.redirect(`${frontendURL}/myprofile?profileid=${profileId}&role=${role}`);
        });
    } catch (e) {
        console.error(e.message);
        res.redirect('register');
    }
};