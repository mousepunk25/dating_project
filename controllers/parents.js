const { query } = require('express-validator');
const ParentProfile = require('../models/parentProfile');
const SonProfile = require('../models/sonProfile');
const Conversation = require('../models/conversation');

// Helper function to format Mongoose validation/pre-save errors
const handleSaveError = (res, e) => {
    // Standard Mongoose ValidationError or custom pre-save Error
    if (e.name === 'ValidationError' || e.message.includes('once every 22 hours')) {
        return res.status(400).json({
            success: false,
            message: e.message
        });
    }
    console.error(e);
    return res.status(500).json({
        success: false,
        message: 'Something went wrong on the server.'
    });
};

// 1. Validation rules
module.exports.validateIndex = [
    query('sonAge')
        .optional()
        .isInt({ min: -1, max: 99 })
        .withMessage('sonAge must be an integer between -1 and 99')
        .toInt(),

    query('city')
        .optional()
        .isString()
        .withMessage('city must be a string')
        .trim()
];

module.exports.index = async (req, res) => {
    const sonAge = req.query.sonAge ?? -1;
    const city = req.query.city ?? '.*';
    try {
        let parents = [];
        if (sonAge > 0) {
            parents = await ParentProfile.find(
                {
                    "sonAgeMin": { $lte: sonAge },
                    "sonAgeMax": { $gte: sonAge },
                    "address.city": { $regex: city, $options: 'i' }
                },
                'fullName address job'
            );
        } else {
            parents = await ParentProfile.find(
                {
                    "address.city": { $regex: city, $options: 'i' }
                },
                'fullName address job'
            );
        }
        res.json(parents);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error fetching parents' });
    }
};

module.exports.showParent = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id, 'fullName address job sonAgeMin sonAgeMax');
        if (!parent) {
            return res.status(404).json({ success: false, message: 'Parent profile not found' });
        }
        res.json(parent);
    } catch (e) {
        console.error(e);
        return next(e);
    }
};

module.exports.updateParent = async (req, res) => {
    const { id } = req.params;
    try {
        const parentProfile = await ParentProfile.findByIdAndUpdate(id, { ...req.body }, { new: true, runValidators: true });
        if (!parentProfile) {
            return res.status(404).json({ success: false, message: 'Parent profile not found' });
        }
        return res.json({ success: true, message: 'Your profile has been updated!' });
    } catch (e) {
        return handleSaveError(res, e);
    }
};

module.exports.sonsWithRequestSentShow = async (req, res) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate({
            path: 'sonsWithRequestSent.sonsWithRequestSentArray'
        });
        if (!parent) {
            return res.status(404).json({ success: false, message: 'Parent profile not found' });
        }
        const sonsList = parent.sonsWithRequestSent?.sonsWithRequestSentArray || [];
        return res.json(sonsList);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: 'Error retrieving sent requests.' });
    }
};

module.exports.sonsWithRequestSentRegister = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ success: false, message: 'Parent or Son profile not found' });
        }

        const isSonFriend = parentProfile.sonsFriends?.sonsFriendsArray?.some(sF => sF.equals(sonid));
        const isSonWithRequestSent = parentProfile.sonsWithRequestSent?.sonsWithRequestSentArray?.some(sW => sW.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded?.some(sW => sW.equals(sonid));

        if (isSonFriend) {
            return res.status(400).json({ success: false, code: 'ALREADY_FRIENDS', message: "This person is already on your friends list." });
        } 
        
        if (isSonWithRequestSent) {
            return res.status(400).json({ success: false, code: 'REQUEST_ALREADY_SENT', message: "You have already sent a request to this person." });
        } 
        
        // Auto-accept scenario: Candidate already requested this parent
        if (isSonWhoWantToBeAdded) {
            parentProfile.sonsFriends.sonsFriendsArray.push(sonid);
            parentProfile.sonsWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.filter(s => !s.equals(sonid));

            sonProfile.parentsFriends.parentsFriendsArray.push(id);
            sonProfile.parentsWithRequestSent.parentsWithRequestSentArray =
                sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));

            let conversation = await Conversation.findOne({ participantParent: id, participantSon: sonid });
            if (!conversation) {
                conversation = new Conversation({ participantParent: id, participantSon: sonid });
                await conversation.save();
            }

            // Mongoose pre('save') triggers rate limit & max 5 array size check
            await parentProfile.save();
            await sonProfile.save();

            return res.json({
                success: true,
                code: 'MUTUAL_MATCH_ADDED',
                message: "Mutual match! This person was on your request list and has been added to your friends.",
                conversationId: conversation._id
            });
        } 

        // Standard Request Sending Path
        parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.push(sonid);
        sonProfile.parentsWhoWantToBeAdded.push(id);

        // Mongoose pre('save') triggers rate limit validation here
        await parentProfile.save();
        await sonProfile.save();

        return res.json({
            success: true,
            code: 'REQUEST_SENT',
            message: "Request sent successfully."
        });

    } catch (e) {
        return handleSaveError(res, e);
    }
};

module.exports.sonsWithRequestSentDelete = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ success: false, message: "Parent or Son profile not found" });
        }

        parentProfile.sonsWithRequestSent.sonsWithRequestSentArray =
            parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.filter(s => !s.equals(sonid));

        sonProfile.parentsWhoWantToBeAdded =
            sonProfile.parentsWhoWantToBeAdded.filter(p => !p.equals(id));

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ success: true, message: "Friend request canceled successfully." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Something went wrong while canceling the request." });
    }
};

module.exports.sonsWhoWantToBeAddedShow = async (req, res) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate('sonsWhoWantToBeAdded');
        if (!parent) {
            return res.status(404).json({ success: false, message: "Parent profile not found" });
        }
        return res.json(parent.sonsWhoWantToBeAdded);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: 'Something went wrong.' });
    }
};

module.exports.sonsWhoWantToBeAddedAccept = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ success: false, message: "Parent or Son profile not found" });
        }

        const isSonFriend = parentProfile.sonsFriends?.sonsFriendsArray?.some(sF => sF.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded?.some(sW => sW.equals(sonid));

        if (isSonFriend) {
            return res.status(400).json({ success: false, message: "This person is already on your friends list." });
        } 
        
        if (!isSonWhoWantToBeAdded) {
            return res.status(400).json({ success: false, message: "This person is not on your pending requests list." });
        }

        parentProfile.sonsFriends.sonsFriendsArray.push(sonid);
        parentProfile.sonsWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.filter(s => !s.equals(sonid));

        sonProfile.parentsFriends.parentsFriendsArray.push(id);
        sonProfile.parentsWithRequestSent.parentsWithRequestSentArray =
            sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));

        let conversation = await Conversation.findOne({ participantParent: id, participantSon: sonid });
        if (!conversation) {
            conversation = new Conversation({ participantParent: id, participantSon: sonid });
            await conversation.save();
        }

        await parentProfile.save();
        await sonProfile.save();

        return res.json({
            success: true,
            message: "Request accepted and candidate added to Friends List.",
            conversationId: conversation._id
        });

    } catch (e) {
        return handleSaveError(res, e);
    }
};

module.exports.sonsWhoWantToBeAddedDelete = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ success: false, message: "Parent or Son profile not found" });
        }

        parentProfile.sonsWhoWantToBeAdded =
            parentProfile.sonsWhoWantToBeAdded.filter(s => !s.equals(sonid));

        sonProfile.parentsWithRequestSent.parentsWithRequestSentArray =
            sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ success: true, message: "Request rejected successfully." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Something went wrong while rejecting the request." });
    }
};

module.exports.sonsFriendsShow = async (req, res) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate({
            path: 'sonsFriends.sonsFriendsArray'
        });
        if (!parent) {
            return res.status(404).json({ success: false, message: "Parent profile not found" });
        }
        return res.json(parent.sonsFriends?.sonsFriendsArray || []);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: 'Something went wrong.' });
    }
};

module.exports.sonsFriendsDelete = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ success: false, message: "Parent or Son profile not found" });
        }

        parentProfile.sonsFriends.sonsFriendsArray =
            parentProfile.sonsFriends.sonsFriendsArray.filter(s => !s.equals(sonid));

        sonProfile.parentsFriends.parentsFriendsArray =
            sonProfile.parentsFriends.parentsFriendsArray.filter(p => !p.equals(id));

        await Conversation.findOneAndDelete({
            participantParent: id,
            participantSon: sonid
        });

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ success: true, message: "Friend removed successfully." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Something went wrong while removing friend." });
    }
};

module.exports.sonsSavedShow = async (req, res) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate('sonsSaved');
        if (!parent) {
            return res.status(404).json({ success: false, message: "Parent profile not found" });
        }
        return res.json(parent.sonsSaved || []);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: 'Something went wrong.' });
    }
};

module.exports.sonsSavedRegister = async (req, res) => {
    const { id, sonid } = req.params;
    console.log('here');
    try {
        let parentProfile = await ParentProfile.findById(id);
        if (!parentProfile) {
            return res.status(404).json({ success: false, message: "Parent profile not found" });
        }

        const isSonFriend = parentProfile.sonsFriends?.sonsFriendsArray?.some(sF => sF.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded?.some(sW => sW.equals(sonid));
        const isSonSaved = parentProfile.sonsSaved?.some(sS => sS.equals(sonid));

        if (isSonFriend) {
            return res.status(400).json({ success: false, message: "This person is already on your friends list." });
        } 
        
        if (isSonWhoWantToBeAdded) {
            return res.status(400).json({ success: false, message: "This person is on your 'Want To Be Added' list." });
        } 
        
        if (isSonSaved) {
            return res.status(400).json({ success: false, message: "This person is already in your saved list." });
        }

        parentProfile.sonsSaved.push(sonid);
        await parentProfile.save();

        return res.json({ success: true, message: "Candidate added to your saved list." });

    } catch (e) {
        return handleSaveError(res, e);
    }
};

module.exports.sonsSavedDelete = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        if (!parentProfile) {
            return res.status(404).json({ success: false, message: "Parent profile not found" });
        }

        parentProfile.sonsSaved = parentProfile.sonsSaved.filter(s => !s.equals(sonid));
        await parentProfile.save();

        return res.json({ success: true, message: "Candidate removed from saved list successfully." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Something went wrong while removing from saved list." });
    }
};