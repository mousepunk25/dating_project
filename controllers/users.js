const crypto = require('crypto');
const path = require('path');
const User = require('../models/user');
const SonProfile = require('../models/sonProfile');
const ParentProfile = require('../models/parentProfile');
const cloudinary = require('cloudinary').v2;
const passport = require('passport');
const sendEmail = require('../utils/sendEmail');

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
            // Check if the user exists but is unverified to give a helpful message
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
        const userId = req.user?._id || req.params.id;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        // 1. Check if user is deleting their own account or has authority
        if (req.user && req.user._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to delete this account." });
        }

        // 2. Fetch associated profiles
        const sonProfile = await SonProfile.findOne({ owner: userId });
        const parentProfile = await ParentProfile.findOne({ owner: userId });

        if (!sonProfile && !parentProfile) {
            // If profile does not exist, just delete the base User document
            await User.findByIdAndDelete(userId);
            req.logout?.(() => { });
            return res.json({ message: "User account deleted successfully." });
        }

        // -------------------------------------------------------------
        // CASE A: User is a Son
        // -------------------------------------------------------------
        if (sonProfile) {
            const sonId = sonProfile._id;

            // Remove Son from all Parents' lists
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

            // Delete all conversations involving this Son
            await Conversation.deleteMany({ participantSon: sonId });

            // Delete image from Cloudinary if stored
            if (sonProfile.image && sonProfile.image.filename) {
                try {
                    await cloudinary.uploader.destroy(sonProfile.image.filename);
                } catch (imgErr) {
                    console.error("Cloudinary cleanup error (Son):", imgErr);
                }
            }

            // Delete Son profile document
            await SonProfile.findByIdAndDelete(sonId);
        }

        // -------------------------------------------------------------
        // CASE B: User is a Parent
        // -------------------------------------------------------------
        if (parentProfile) {
            const parentId = parentProfile._id;

            // Remove Parent from all Sons' lists
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

            // Delete all conversations involving this Parent
            await Conversation.deleteMany({ participantParent: parentId });

            // Delete Parent profile document
            await ParentProfile.findByIdAndDelete(parentId);
        }

        // 3. Delete the primary User account
        await User.findByIdAndDelete(userId);

        // 4. Logout session and clear authentication context
        req.logout((err) => {
            if (err) {
                console.error("Error logging out during deletion:", err);
            }
            return res.json({ message: "User and all related data deleted successfully." });
        });

    } catch (e) {
        console.error("Error deleting user:", e);
        return res.status(500).json({ message: "An error occurred while deleting the user account." });
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
            jobParent, // Fallback for backward compatibility
            jobSon,    // Fallback for backward compatibility
            educationLevel,
            image: imageInput
        } = req.body;

        // Resolve common job field
        const userJob = job || (role === 'parent' ? jobParent : jobSon) || '';

        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenExpires = Date.now() + 24 * 60 * 60 * 1000;

        const user = new User({
            email,
            role,
            isVerified: false,
            verificationToken: hashedToken,
            verificationTokenExpires: tokenExpires
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
                // Determine source to upload
                const sourceToUpload = imageInput || placeholderPath;

                // 1. Build dynamic upload configuration based on environment
                const uploadOptions = {
                    folder: 'profile_pictures'
                };

                // Only enable AWS Rekognition moderation outside the dev environment
                if (process.env.ENVIRONMENT_VERSION !== 'dev') {
                    uploadOptions.moderation = 'aws_rek';
                }

                const uploadResult = await cloudinary.uploader.upload(sourceToUpload, uploadOptions);

                // 2. Check Moderation Status (only executed if moderation was configured and triggered)
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

    // Hash the token from query param to match what's in DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        verificationToken: hashedToken,
        verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
        return res.redirect(`${frontendURL}/myprofile?error=invalid-or-expired-token`);
    }

    // Mark verified & wipe token fields
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

        // Security practice: Return success even if email isn't found
        // to prevent bad actors from checking registered email addresses.
        if (!user || user.isVerified) {
            return res.status(200).json({
                message: 'If an unverified account exists with that email, a new link has been sent.'
            });
        }

        // 1. Generate new token & expiration
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 Hours

        // 2. Update user document
        user.verificationToken = hashedToken;
        user.verificationTokenExpires = tokenExpires;
        await user.save();

        // 3. Resend email via Resend helper
        await sendEmail({
            to: user.email,
            template: 'verification',
            payload: { token: rawToken }
        });

        res.status(200).json({
            message: 'If an unverified account exists with that email, a new link has been sent.'
        });

    } catch (e) {
        console.error('Error in resendVerificationEmail:', e);
        res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
    }
};

module.exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const user = await User.findOne({ email });

        // Generic response prevents account enumeration attacks
        if (!user) {
            return res.status(200).json({
                message: 'If an account exists with that email, a password reset link has been sent.'
            });
        }

        // 1. Generate unhashed token for client and hashed token for DB storage
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenExpires = Date.now() + 60 * 60 * 1000; // 1 Hour

        // 2. Save token state to user document
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = tokenExpires;
        await user.save();

        // 3. Dispatch verification email containing the raw token link
        // Note: Replace or update sendVerificationEmail helper if you have a distinct reset email template helper
        await sendEmail({
            to: user.email,
            template: 'reset-password',
            payload: { token: rawToken }
        });

        res.status(200).json({
            message: 'If an account exists with that email, a password reset link has been sent.'
        });

    } catch (e) {
        console.error('Error in requestPasswordReset:', e);
        res.status(500).json({ error: 'An error occurred while requesting password reset.' });
    }
};

module.exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required.' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
        }

        // Set password using passport-local-mongoose plugin interface
        await user.setPassword(newPassword);

        // Clear token fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password has been successfully updated.' });

    } catch (e) {
        console.error('Error in resetPassword:', e);
        res.status(500).json({ error: 'An error occurred while resetting the password.' });
    }
};