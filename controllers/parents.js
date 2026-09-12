const { query } = require('express-validator');

const ParentProfile = require('../models/parentProfile');
const SonProfile = require('../models/sonProfile');
const Conversation = require('../models/conversation');

// 1. Define validation rules
module.exports.validateIndex = [
    query('sonAge')
        .optional()
        .isInt({ min: -1, max: 99 })
        .withMessage('sonAgeMin must be an integer between -1 and 99')
        .toInt(), // Converts input string to integer

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
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports.showParent = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id, 'fullName address job sonAgeMin sonAgeMax');
        res.json(parent);

    } catch (e) {
        console.log(e);
        return next(err);
    }
}

module.exports.updateParent = async (req, res, next) => {
    const { id } = req.params;
    try {
        const parentProfile = await ParentProfile.findByIdAndUpdate(id, { ...req.body });
        await parentProfile.save();
    } catch (e) {
        return res.json({ "message": "There was some issue with updating your profile" });
    }
    return res.json({ "message": "Your profile has beed updated!" });
}

module.exports.sonsWithRequestSentShow = async (req, res) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate({
            path: 'sonsWithRequestSent',
            populate: { path: 'sonsWithRequestSentArray' }
        });
        const sonsList = parent.sonsWithRequestSent.sonsWithRequestSentArray;
        return res.json(sonsList);
    } catch (e) {
        console.log(e.message);
        return res.json({ 'message': 'Something went wrong.' });
    }
}

module.exports.sonsWithRequestSentRegister = async (req, res, next) => {
    const { id, sonid } = req.params; // id = ParentProfile ID, sonid = SonProfile ID
    try {
        let parentProfile = await ParentProfile.findById(id);
        const isSonFriend = parentProfile.sonsFriends.sonsFriendsArray.some(sF => sF.equals(sonid));
        const isSonWithRequestSent = parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.some(sW => sW.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.some(sW => sW.equals(sonid));

        if (isSonFriend) {
            return res.json({ "message": "This man is already on your friend's list" });
        } else if (isSonWithRequestSent) {
            return res.json({ "message": "You've already sent a request to him" });
        } else if (isSonWhoWantToBeAdded) {
            // 1. Update Parent and Son profile relationships
            parentProfile.sonsFriends.sonsFriendsArray.push(sonid);
            parentProfile.sonsWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.filter(s => !s.equals(sonid));

            let sonProfile = await SonProfile.findById(sonid);
            sonProfile.parentsFriends.parentsFriendsArray.push(id);
            sonProfile.parentsWithRequestSent.parentsWithRequestSentArray =
                sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));

            // 2. Find or create a new Conversation
            let conversation = await Conversation.findOne({
                participantParent: id,
                participantSon: sonid
            });

            if (!conversation) {
                conversation = new Conversation({
                    participantParent: id,
                    participantSon: sonid
                });
                await conversation.save();
            }

            // 3. Save updated profiles
            await parentProfile.save();
            await sonProfile.save();

            return res.json({
                "message": "This man was on your 'Want To Be Added' list.",
                "conversationId": conversation._id
            });
        } else {
            // Standard request sending path
            parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.push(sonid);
            let sonProfile = await SonProfile.findById(sonid);
            sonProfile.parentsWhoWantToBeAdded.push(id);

            await parentProfile.save();
            await sonProfile.save();

            return res.json({
                "message": "Request sent successfully.",
                "status": 200
            });
        }
    } catch (e) {
        console.log(e);
        return res.json({ "message": "Something went wrong" });
    }
};

module.exports.sonsWithRequestSentDelete = async (req, res, next) => {
    const { id, sonid } = req.params; // id = ParentProfile ID, sonid = SonProfile ID
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ "message": "Parent or Son profile not found" });
        }

        // Remove Son from Parent's sonsWithRequestSent array
        parentProfile.sonsWithRequestSent.sonsWithRequestSentArray =
            parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.filter(s => !s.equals(sonid));

        // Remove Parent from Son's parentsWhoWantToBeAdded array
        sonProfile.parentsWhoWantToBeAdded =
            sonProfile.parentsWhoWantToBeAdded.filter(p => !p.equals(id));

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ "message": "Friend request canceled successfully." });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "message": "Something went wrong while canceling the request." });
    }
};

module.exports.sonsWhoWantToBeAddedShow = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate('sonsWhoWantToBeAdded');
        const sonsList = parent.sonsWhoWantToBeAdded;
        return res.json(sonsList);
    } catch (e) {
        console.log(e.message);
        return res.json({ 'message': 'Something went wrong.' });
    }
}

module.exports.sonsWhoWantToBeAddedAccept = async (req, res, next) => {
    const { id, sonid } = req.params; // id = ParentProfile ID, sonid = SonProfile ID
    try {
        let parentProfile = await ParentProfile.findById(id);
        const isSonFriend = parentProfile.sonsFriends.sonsFriendsArray.some(sF => sF.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.some(sW => sW.equals(sonid));

        if (isSonFriend) {
            return res.json({ "message": "This man is already on your friend's list" });
        } else if (isSonWhoWantToBeAdded) {
            // 1. Update Parent and Son profiles
            parentProfile.sonsFriends.sonsFriendsArray.push(sonid);
            parentProfile.sonsWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.filter(s => !s.equals(sonid));

            let sonProfile = await SonProfile.findById(sonid);
            sonProfile.parentsFriends.parentsFriendsArray.push(id);
            sonProfile.parentsWithRequestSent.parentsWithRequestSentArray =
                sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));

            // 2. Find or create Conversation using participantParent and participantSon
            let conversation = await Conversation.findOne({
                participantParent: id,
                participantSon: sonid
            });

            if (!conversation) {
                conversation = new Conversation({
                    participantParent: id,
                    participantSon: sonid
                });
                await conversation.save();
            }

            await parentProfile.save();
            await sonProfile.save();

            return res.json({
                "message": "This son was added to your Friends List",
                "conversationId": conversation._id
            });
        } else {
            return res.json({ "message": "This man is not on your 'Want to be added' list" });
        }
    } catch (e) {
        console.log(e.message);
        return res.json({ "message": "Something went wrong" });
    }
};

module.exports.sonsWhoWantToBeAddedDelete = async (req, res, next) => {
    const { id, sonid } = req.params; // id = ParentProfile ID, sonid = SonProfile ID
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ "message": "Parent or Son profile not found" });
        }

        // Remove Son from Parent's sonsWhoWantToBeAdded array
        parentProfile.sonsWhoWantToBeAdded =
            parentProfile.sonsWhoWantToBeAdded.filter(s => !s.equals(sonid));

        // Remove Parent from Son's parentsWithRequestSent array
        sonProfile.parentsWithRequestSent.parentsWithRequestSentArray =
            sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ "message": "Request rejected successfully." });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "message": "Something went wrong while rejecting the request." });
    }
};

module.exports.sonsFriendsShow = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate({
            path: 'sonsFriends',
            populate: { path: 'sonsFriendsArray' }
        });
        const sonsList = parent.sonsFriends.sonsFriendsArray;
        return res.json(sonsList);
    } catch (e) {
        console.log(e.message);
        return res.json({ 'message': 'Something went wrong.' });
    }
}

module.exports.sonsFriendsDelete = async (req, res, next) => {
    const { id, sonid } = req.params; // id = ParentProfile ID, sonid = SonProfile ID
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ "message": "Parent or Son profile not found" });
        }

        // Remove Son from Parent's friends list
        parentProfile.sonsFriends.sonsFriendsArray =
            parentProfile.sonsFriends.sonsFriendsArray.filter(s => !s.equals(sonid));

        // Remove Parent from Son's friends list
        sonProfile.parentsFriends.parentsFriendsArray =
            sonProfile.parentsFriends.parentsFriendsArray.filter(p => !p.equals(id));

        // Clean up active conversation between them
        await Conversation.findOneAndDelete({
            participantParent: id,
            participantSon: sonid
        });

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ "message": "Friend removed successfully." });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "message": "Something went wrong while removing friend." });
    }
};

module.exports.sonsSavedShow = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate('sonsSaved');
        const sonsList = parent.sonsSaved;
        return res.json(sonsList);
    } catch (e) {
        console.log(e.message);
        return res.json({ 'message': 'Something went wrong.' });
    }
}

module.exports.sonsSavedRegister = async (req, res, next) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        const isSonFriend = parentProfile.sonsFriends.sonsFriendsArray.some(sF => sF.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.some(sW => sW.equals(sonid));
        const isSonSaved = parentProfile.sonsSaved.some(sS => sS.equals(sonid));
        if (isSonFriend) {
            return res.json({ "message": "This man is already on your friend's list" });
        } else if (isSonWhoWantToBeAdded) {
            return res.json({ "message": "This man was on your 'Want To Be Added' list." });
        } else if (isSonSaved) {
            return res.json({ "message": "This man is already saved" });
        }
        else {
            parentProfile.sonsSaved.push(sonid);
            await parentProfile.save();
            return res.json({ "message": "This man was added to your saved friend's list." })
        }
    } catch (e) {
        return res.json({
            "message": "Something went wrong",
            "status": 200
        });
    }
}

module.exports.sonsSavedDelete = async (req, res, next) => {
    const { id, sonid } = req.params; // id = ParentProfile ID, sonid = SonProfile ID
    try {
        let parentProfile = await ParentProfile.findById(id);

        if (!parentProfile) {
            return res.status(404).json({ "message": "Parent profile not found" });
        }

        // Remove Son from Parent's sonsSaved array
        parentProfile.sonsSaved = parentProfile.sonsSaved.filter(s => !s.equals(sonid));

        await parentProfile.save();

        return res.json({ "message": "Son removed from saved list successfully." });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "message": "Something went wrong while removing from saved list." });
    }
};