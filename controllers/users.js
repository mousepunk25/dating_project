const crypto = require('crypto');
const path = require('path');
const User = require('../models/user');
const SonProfile = require('../models/sonProfile');
const ParentProfile = require('../models/parentProfile');
const Conversation = require('../models/conversation')
const cloudinary = require('cloudinary').v2;
const passport = require('passport');
const sendEmail = require('../utils/sendEmail');
const {validateEmailLimits} = require('./authController');
const Message = require('../models/message');

const frontendURL = process.env.ENVIRONMENT_VERSION === 'dev'
    ? process.env.DEV_FRONTEND_URL
    : process.env.PROD_FRONTEND_URL;

// Configure Cloudinary once outside the function or at application startup
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports.renderLogin = (req, res) => {
    res.sendFile(path.join(__dirname, '../views/login.html'));
}

module.exports.login = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            User.findOne({ email: req.body.username }).then(foundUser => {
                if (foundUser && !foundUser.isVerified) {
                    return res.redirect(`${frontendURL}/myprofile?error=email-not-verified`);
                }
                return res.redirect(`${frontendURL}/myprofile?error=invalid-credentials`);
            });
            return;
        }

        req.login(user, async (err) => {
            if (err) return next(err);
            const foundSonProfiles = await SonProfile.find().populate({
                path: 'owner',
                select: '_id'
            }).exec();
            const foundSonProfile = foundSonProfiles.find(fSP => fSP.owner._id.equals(user._id));
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
        });
    })(req, res, next);
}

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect(`${frontendURL}/myprofile?logout=true`);
    });
}

module.exports.deleteUser = async (req, res, next) => {
    try {
        const userId = req.user?._id || null;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        if (req.user && req.user._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to delete this account." });
        }

        // 1. Delete all messages sent by this user
        await Message.deleteMany({ sender: userId });

        // 2. Remove user ID from any 'readBy' arrays in remaining messages
        await Message.updateMany(
            { readBy: userId },
            { $pull: { readBy: userId } }
        );

        const sonProfile = await SonProfile.findOne({ owner: userId });
        const parentProfile = await ParentProfile.findOne({ owner: userId });

        // If the user has neither profile, delete the User document and exit
        if (!sonProfile && !parentProfile) {
            await User.findByIdAndDelete(userId);
            req.logout?.(() => { });
            return res.json({ message: "User account deleted successfully." });
        }

        if (sonProfile) {
            const sonId = sonProfile._id;

            await ParentProfile.updateMany(
                {},
                {
                    $pull: {
                        "sonsFriends.sonsFriendsArray": { _id: sonId },
                        "sonsWithRequestSent.sonsWithRequestSentArray": { _id: sonId },
                        sonsWhoWantToBeAdded: sonId,
                        sonsSaved: sonId
                    }
                }
            );

            await Conversation.deleteMany({ participantSon: sonId });

            if (sonProfile.image && sonProfile.image.filename) {
                try {
                    await cloudinary.uploader.destroy(sonProfile.image.filename);
                } catch (imgErr) {
                    console.error("Cloudinary cleanup error (Son):", imgErr);
                }
            }

            await SonProfile.findByIdAndDelete(sonId);
        }

        if (parentProfile) {
            const parentId = parentProfile._id;

            await SonProfile.updateMany(
                {},
                {
                    $pull: {
                        "parentsFriends.parentsFriendsArray": { _id: parentId },
                        "parentsWithRequestSent.parentsWithRequestSentArray": { _id: parentId },
                        parentsWhoWantToBeAdded: parentId,
                        parentsSaved: parentId
                    }
                }
            );

            await Conversation.deleteMany({ participantParent: parentId });

            await ParentProfile.findByIdAndDelete(parentId);
        }

        await User.findByIdAndDelete(userId);

        req.logout((err) => {
            if (err) {
                console.error("Error logging out during deletion:", err);
            }
            return res.json({ message: "Twój profil został usunięty." });
        });

    } catch (e) {
        console.error("Error deleting user:", e);
        return res.status(500).json({ message: "Pojawił się błąd w trakcie usuwania profilu użytkownika." });
    }
};

module.exports.register = async (req, res, next) => {
    try {
        const {
            email,
            password,
            role,
            fullNameParent,
            cityParent,
            fullNameSon,
            dateOfBirth,
            citySon,
            aboutYou,
            job,
            jobParent,
            jobSon,
            educationLevel,
            image: imageInput
        } = req.body;

        const userJob = job || (role === 'parent' ? jobParent : jobSon) || '';

        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenExpires = Date.now() + 24 * 60 * 60 * 1000;

        const user = new User({
            email,
            role,
            isVerified: false,
            verificationToken: hashedToken,
            verificationTokenExpires: tokenExpires,
            emailSentHistory: [new Date()] // Initialize with first registration email timestamp
        });

        const registeredUser = await User.register(user, password);
        let profileId = '';

        if (role === 'parent') {
            const parentProfile = new ParentProfile({
                owner: registeredUser._id,
                fullName: fullNameParent,
                job: userJob,
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
                const sourceToUpload = imageInput || placeholderPath;

                const uploadOptions = {
                    folder: 'profile_pictures'
                };

                if (process.env.ENVIRONMENT_VERSION !== 'dev') {
                    uploadOptions.moderation = 'aws_rek';
                }

                const uploadResult = await cloudinary.uploader.upload(sourceToUpload, uploadOptions);

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
                job: { position: userJob, companyName: '' },
                education: { educationLevel: educationLevel }
            });

            await sonProfile.save();
            profileId = sonProfile._id;
        }

        await sendEmail({
            to: user.email,
            template: 'verification',
            payload: { token: rawToken }
        });

        res.redirect(`${frontendURL}/myprofile?status=verification-sent`);

    } catch (e) {
        console.error(e.message);
        res.redirect('register');
    }
};

module.exports.verifyEmail = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.redirect(`${frontendURL}/myprofile?error=missing-token`);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        verificationToken: hashedToken,
        verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
        return res.redirect(`${frontendURL}/myprofile?error=invalid-or-expired-token`);
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.redirect(`${frontendURL}/myprofile?verified=true`);
};

module.exports.resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email });

        if (!user || user.isVerified) {
            return res.status(200).json({
                message: 'Jeżeli istnieje takie niezweryfikowane konto, nowy email weryfikacyjny został wysłany.'
            });
        }

        // Validate rate limits
        const rateCheck = validateEmailLimits(user);
        if (!rateCheck.allowed) {
            return res.status(429).json({ error: rateCheck.message });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenExpires = Date.now() + 24 * 60 * 60 * 1000;

        user.verificationToken = hashedToken;
        user.verificationTokenExpires = tokenExpires;
        user.emailSentHistory.push(new Date()); // Push new timestamp
        await user.save();

        await sendEmail({
            to: user.email,
            template: 'verification',
            payload: { token: rawToken }
        });

        res.status(200).json({
            message: 'Jeżeli istnieje takie niezweryfikowane konto, nowy email weryfikacyjny został wysłany.'
        });

    } catch (e) {
        console.error('Error in resendVerificationEmail:', e);
        res.status(500).json({ error: 'Coś poszło nie tak po naszej stronie. Spróbuj ponownie później.' });
    }
};

module.exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email jest wymagany.' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({
                message: 'Jeżeli istnieje takie konto, email z linkiem resetującym hasło został wysłany.'
            });
        }

        // Validate rate limits
        const rateCheck = validateEmailLimits(user);
        if (!rateCheck.allowed) {
            return res.status(429).json({ error: rateCheck.message });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenExpires = Date.now() + 60 * 60 * 1000;

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = tokenExpires;
        user.emailSentHistory.push(new Date()); // Push new timestamp
        await user.save();

        await sendEmail({
            to: user.email,
            template: 'reset-password',
            payload: { token: rawToken }
        });

        res.status(200).json({
            message: 'Jeżeli istnieje takie konto, email z linkiem resetującym hasło został wysłany.'
        });

    } catch (e) {
        console.error('Error in requestPasswordReset:', e);
        res.status(500).json({ error: 'Pojawił się błąd przy prośbie o reset hasła.' });
    }
};

module.exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token i nowe hasło są wymagane.' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token jest niewłaściwy albo się przedawnił.' });
        }

        await user.setPassword(newPassword);

        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Hasło zostało zmienione.' });

    } catch (e) {
        console.error('Error in resetPassword:', e);
        res.status(500).json({ error: 'Pojawił się błąd w trakcie resetowania hasła.' });
    }
};