const { query } = require('express-validator');
const ParentProfile = require('../models/parentProfile');
const SonProfile = require('../models/sonProfile');
const Conversation = require('../models/conversation');

const TWENTY_TWO_HOURS_MS = 22 * 60 * 60 * 1000;

// Helper to check 22-hour rate limit on controller level
const checkTwentyTwoHourLimit = (parentProfile) => {
    const now = Date.now();

    const lastSonAdded = parentProfile.sonsFriends?.dateWhenLastSonAdded
        ? new Date(parentProfile.sonsFriends.dateWhenLastSonAdded).getTime()
        : 0;

    const lastRequestSent = parentProfile.sonsWithRequestSent?.dateWhenLastRequestWasSent
        ? new Date(parentProfile.sonsWithRequestSent.dateWhenLastRequestWasSent).getTime()
        : 0;

    const latestActionTime = Math.max(lastSonAdded, lastRequestSent);

    if (latestActionTime > 0 && (now - latestActionTime) < TWENTY_TWO_HOURS_MS) {
        const remainingHours = ((TWENTY_TWO_HOURS_MS - (now - latestActionTime)) / (1000 * 60 * 60)).toFixed(1);
        return `Możesz WYSŁAĆ lub PRZYJĄĆ zaproszenie raz na 22 godziny. Zaczekaj proszę pozostałe ${remainingHours} godz.`;
    }

    return null;
};

// Helper function to format Mongoose validation errors
const handleSaveError = (res, e) => {
    let errorMessage = e.message;

    if (e.name === 'ValidationError') {
        const firstErrorKey = Object.keys(e.errors)[0];
        if (firstErrorKey) {
            errorMessage = e.errors[firstErrorKey].message;
        }
    }

    if (e.name === 'ValidationError' || e.message?.includes('raz na 22 godziny')) {
        return res.status(400).json({
            success: false,
            message: errorMessage
        });
    }

    console.error(e);
    return res.status(500).json({
        success: false,
        message: 'Coś nie zadziałało po stronie serwera.'
    });
};

// 1. Validation rules & Index
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
                    "address.city": { $regex: city,$options: 'i' }
                },
                'fullName address job'
            );
        } else {
            parents = await ParentProfile.find(
                {
                    "address.city": { $regex: city,$options: 'i' }
                },
                'fullName address job'
            );
        }
        res.json(parents);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Coś nie zadziałało po stronie serwera.' });
    }
};

module.exports.showParent = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id, 'fullName address job sonAgeMin sonAgeMax');
        if (!parent) {
            return res.status(404).json({ success: false, message: 'Nie znaleziono profilu rodzica.' });
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
            return res.status(404).json({ success: false, message: 'Nie znaleziono profilu rodzica.' });
        }
        return res.json({ success: true, message: 'Twój profil został zaktualizowany!' });
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
            return res.status(404).json({ success: false, message: 'Nie znaleziono profilu rodzica.' });
        }
        const sonsList = parent.sonsWithRequestSent?.sonsWithRequestSentArray || [];
        return res.json(sonsList);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: 'Błąd podczas pobierania wysłanych zaproszeń.' });
    }
};

module.exports.sonsWithRequestSentRegister = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ success: false, message: 'Profil rodzica lub zięcia nie znalezione.' });
        }

        const isSonFriend = parentProfile.sonsFriends?.sonsFriendsArray?.some(item => item.son.equals(sonid));
        const isSonWithRequestSent = parentProfile.sonsWithRequestSent?.sonsWithRequestSentArray?.some(sW => sW.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded?.some(item => item.son.equals(sonid));

        if (isSonFriend) {
            return res.status(400).json({ success: false, code: 'ALREADY_FRIENDS', message: "Ta osoba jest już na Twojej liście znajomych." });
        }

        if (isSonWithRequestSent) {
            return res.status(400).json({ success: false, code: 'REQUEST_ALREADY_SENT', message: "Wysłałeś już wcześniej zaproszenie tej osobie." });
        }

        // Validate 22-hour cooldown before performing action
        const rateLimitError = checkTwentyTwoHourLimit(parentProfile);
        if (rateLimitError) {
            return res.status(400).json({ success: false, message: rateLimitError });
        }

        const now = new Date();

        // Auto-accept scenario: Candidate already requested this parent
        if (isSonWhoWantToBeAdded) {
            if (!parentProfile.sonsFriends) parentProfile.sonsFriends = {};
            parentProfile.sonsFriends.dateWhenLastSonAdded = now;
            parentProfile.sonsFriends.sonsFriendsArray.push({ son: sonid });
            parentProfile.sonsWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.filter(item => !item.son.equals(sonid));

            if (!sonProfile.parentsFriends) sonProfile.parentsFriends = {};
            sonProfile.parentsFriends.dateWhenLastParentAdded = now;
            sonProfile.parentsFriends.parentsFriendsArray.push({ parent: id });
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
                code: 'MUTUAL_MATCH_ADDED',
                message: "Udało się! Ta osoba została dodana do listy znajomych. Możesz z nią teraz czatować.",
                conversationId: conversation._id
            });
        }

        // Standard Request Sending Path
        if (!parentProfile.sonsWithRequestSent) parentProfile.sonsWithRequestSent = {};
        parentProfile.sonsWithRequestSent.dateWhenLastRequestWasSent = now;
        parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.push(sonid);

        sonProfile.parentsWhoWantToBeAdded.push({ parent: id });

        await parentProfile.save();
        await sonProfile.save();

        return res.json({
            success: true,
            code: 'REQUEST_SENT',
            message: "Zaproszenie wysłano pomyślnie."
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
            return res.status(404).json({ success: false, message: "Profil rodzica lub zięcia nie znalezione." });
        }

        parentProfile.sonsWithRequestSent.sonsWithRequestSentArray =
            parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.filter(s => !s.equals(sonid));

        sonProfile.parentsWhoWantToBeAdded =
            sonProfile.parentsWhoWantToBeAdded.filter(item => !item.parent?.equals(id));

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ success: true, message: "Anulowano zaproszenie." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Coś poszło nie tak z anulowaniem zaproszenia." });
    }
};

module.exports.sonsWhoWantToBeAddedShow = async (req, res) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate({
            path: 'sonsWhoWantToBeAdded.son'
        });

        if (!parent) {
            return res.status(404).json({ success: false, message: "Profil rodzica nie odnaleziony." });
        }

        const hasUnseen = parent.sonsWhoWantToBeAdded?.some(item => !item.seen);

        if (hasUnseen) {
            await ParentProfile.updateOne(
                { _id: req.params.id },
                { $set: { "sonsWhoWantToBeAdded.$[].seen": true } }
            );

            parent.sonsWhoWantToBeAdded.forEach(item => {
                item.seen = true;
            });
        }

        return res.json(parent.sonsWhoWantToBeAdded || []);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: 'Coś poszło nie tak.' });
    }
};

module.exports.sonsWhoWantToBeAddedAccept = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ success: false, message: "Profil rodzica lub zięcia nie znaleziony." });
        }

        const isSonFriend = parentProfile.sonsFriends?.sonsFriendsArray?.some(item => item.son.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded?.some(item => item.son.equals(sonid));

        if (isSonFriend) {
            return res.status(400).json({ success: false, message: "Ta osoba jest już na Twojej liście znajomych." });
        }

        if (!isSonWhoWantToBeAdded) {
            return res.status(400).json({ success: false, message: "Ta osoba nie znajduje się na Twojej liście oczekujących zaproszeń." });
        }

        // Validate 22-hour cooldown before accepting request
        const rateLimitError = checkTwentyTwoHourLimit(parentProfile);
        if (rateLimitError) {
            return res.status(400).json({ success: false, message: rateLimitError });
        }

        const now = new Date();

        if (!parentProfile.sonsFriends) parentProfile.sonsFriends = {};
        parentProfile.sonsFriends.dateWhenLastSonAdded = now;
        parentProfile.sonsFriends.sonsFriendsArray.push({ son: sonid });
        parentProfile.sonsWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.filter(item => !item.son.equals(sonid));

        if (!sonProfile.parentsFriends) sonProfile.parentsFriends = {};
        sonProfile.parentsFriends.dateWhenLastParentAdded = now;
        sonProfile.parentsFriends.parentsFriendsArray.push({ parent: id });
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
            message: "Zaproszenie zaakceptowane i ta osoba została dodana do listy znajomych. Możesz z nią teraz czatować.",
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
            return res.status(404).json({ success: false, message: "Profil rodzica lub zięcia nie znaleziony." });
        }

        parentProfile.sonsWhoWantToBeAdded =
            parentProfile.sonsWhoWantToBeAdded.filter(item => !item.son.equals(sonid));

        sonProfile.parentsWithRequestSent.parentsWithRequestSentArray =
            sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ success: true, message: "Zaproszenie zostało odrzucone." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Coś poszło nie tak przy odrzucaniu zaproszenia." });
    }
};

module.exports.sonsFriendsShow = async (req, res) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate({
            path: 'sonsFriends.sonsFriendsArray.son'
        });

        if (!parent) {
            return res.status(404).json({ success: false, message: "Profil rodzica nie znaleziony." });
        }

        const friendsList = parent.sonsFriends?.sonsFriendsArray || [];
        const hasUnseen = friendsList.some(item => !item.seen);

        if (hasUnseen) {
            await ParentProfile.updateOne(
                { _id: req.params.id },
                { $set: { "sonsFriends.sonsFriendsArray.$[].seen": true } }
            );

            friendsList.forEach(item => {
                item.seen = true;
            });
        }

        return res.json(friendsList);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: 'Coś poszło nie tak.' });
    }
};

module.exports.sonsFriendsDelete = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        let sonProfile = await SonProfile.findById(sonid);

        if (!parentProfile || !sonProfile) {
            return res.status(404).json({ success: false, message: "Profil rodzica lub zięcia nie znaleziony." });
        }

        parentProfile.sonsFriends.sonsFriendsArray =
            parentProfile.sonsFriends.sonsFriendsArray.filter(item => !item.son.equals(sonid));

        sonProfile.parentsFriends.parentsFriendsArray =
            sonProfile.parentsFriends.parentsFriendsArray.filter(p => !p.equals(id));

        await Conversation.findOneAndDelete({
            participantParent: id,
            participantSon: sonid
        });

        await parentProfile.save();
        await sonProfile.save();

        return res.json({ success: true, message: "Znajomy został usunięty z listy." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Coś poszło nie tak przy usuwaniu znajomego z listy." });
    }
};

module.exports.sonsSavedShow = async (req, res) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate('sonsSaved');
        if (!parent) {
            return res.status(404).json({ success: false, message: "Profil rodzica nie znaleziony." });
        }
        return res.json(parent.sonsSaved || []);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: 'Coś poszło nie tak.' });
    }
};

module.exports.sonsSavedRegister = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        if (!parentProfile) {
            return res.status(404).json({ success: false, message: "Profil rodzica nie znaleziony." });
        }

        const isSonFriend = parentProfile.sonsFriends?.sonsFriendsArray?.some(item => item.son.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded?.some(item => item.son.equals(sonid));
        const isSonSaved = parentProfile.sonsSaved?.some(sS => sS.equals(sonid));

        if (isSonFriend) {
            return res.status(400).json({ success: false, message: "Ta osoba jest już na Twojej liście znajomych." });
        }

        if (isSonWhoWantToBeAdded) {
            return res.status(400).json({ success: false, message: "Ta osoba jest na liście osób, które chcą zostać dodane do Twoich znajomych." });
        }

        if (isSonSaved) {
            return res.status(400).json({ success: false, message: "Ta osoba jest już na Twojej liście zapisanych osób." });
        }

        parentProfile.sonsSaved.push(sonid);
        await parentProfile.save();

        return res.json({ success: true, message: "Kandydat został zapisany i możesz go znaleźć na liście zapisanych kandydatów." });

    } catch (e) {
        return handleSaveError(res, e);
    }
};

module.exports.sonsSavedDelete = async (req, res) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        if (!parentProfile) {
            return res.status(404).json({ success: false, message: "Profil rodzica nie znaleziony." });
        }

        parentProfile.sonsSaved = parentProfile.sonsSaved.filter(s => !s.equals(sonid));
        await parentProfile.save();

        return res.json({ success: true, message: "Kandydat został usunięty z listy zapisanych kandydatów." });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ success: false, message: "Coś poszło nie tak przy usuwaniu kandydata z listy zapisanych kandydatów." });
    }
};