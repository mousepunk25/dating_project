const User = require('../models/user');
const ParentProfile = require('../models/parentProfile');
const SonProfile = require('../models/sonProfile');

module.exports.index = async (req, res) => {
    const { sonAgeMin = 18, sonAgeMax = 99, city = '.*' } = req.query;
    let parents = await ParentProfile.find({ "sonAgeMin": { $gte: sonAgeMin }, "sonAgeMax": { $lte: sonAgeMax }, "address.city": { $regex: `${city}`, $options: 'i' } }, 'name address job');
    res.json(parents);
}

module.exports.showParent = async (req, res, next) => {
    try {
       const parent = await ParentProfile.findById(req.params.id, 'name surname dateOfBirth address job education hobbies aboutYou images socialMedia');
       console.log('parent', parent);
       res.json(parent);

    } catch (e) {
        console.log(e);
        return next(err);
    }
}

module.exports.register = async (req, res, next) => {
    const { email, name, password, job, hobbies, address, sonAgeMin, sonAgeMax } = req.body;
    const user = new User({ email, name, role: 'parent' });
    // res.send("That's the controler registering parent");
    let registeredUser = {};
    try {
        registeredUser = await User.register(user, password);
    } catch (e) {
        return res.send("We have such user in the database");
    }
    if (Object.keys(registeredUser).length !== 0) {
        const parentProfile = new ParentProfile({
            owner: registeredUser._id,
            job,
            hobbies,
            address,
            sonAgeMin,
            sonAgeMax,
            doughters
        });
        try {
            parentProfile.save();
        } catch (e) {
            console.log(e);
        }
        req.login(registeredUser, err => {
            if (err) return next(err);
            return res.json({ "message": 'You are logged int', "userId": registeredUser._id });
        })
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
            populate: {path: 'sonsWithRequestSentArray'}
        });
        const sonsList =  parent.sonsWithRequestSent.sonsWithRequestSentArray;
        return res.json(sonsList);
    } catch (e) {
        console.log(e.message);
        return res.json({'message': 'Something went wrong.'});
    }
}

module.exports.sonsWithRequestSentRegister = async (req, res, next) => {
    const { id, sonid } = req.params;
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
            parentProfile.sonsFriends.sonsFriendsArray.push(sonid);
            parentProfile.sonsWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.filter(s => !s.equals(sonid));
            let sonProfile = await SonProfile.findById(sonid);
            sonProfile.parentsFriends.parentsFriendsArray.push(id);
            sonProfile.parentsWithRequestSent = sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));
            await parentProfile.save();
            await sonProfile.save();
            return res.json({ "message": "This man was on your 'Want To Be Added' list." });
        } else {
            parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.push(sonid);
            await parentProfile.save();
            return res.json({ "message": "This man was added to your friend's list." })
        }
    } catch (e) {
        return res.json({ "message": "Something went wrong" });
    }
}

module.exports.sonsWhoWantToBeAddedShow = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate('sonsWhoWantToBeAdded');
        const sonsList =  parent.sonsWhoWantToBeAdded;
        return res.json(sonsList);
    } catch (e) {
        console.log(e.message);
        return res.json({'message': 'Something went wrong.'});
    }
}

module.exports.sonsWhoWantToBeAddedAccept = async (req, res, next) => {
    const { id, sonid } = req.params;
    try {
        let parentProfile = await ParentProfile.findById(id);
        const isSonFriend = parentProfile.sonsFriends.sonsFriendsArray.some(sF => sF.equals(sonid));
        const isSonWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.some(sW => sW.equals(sonid));
        if (isSonFriend) {
            return res.json({ "message": "This man is already on your friend's list" });
        } else if (isSonWhoWantToBeAdded) {
            parentProfile.sonsFriends.sonsFriendsArray.push(sonid);
            parentProfile.sonsWhoWantToBeAdded = parentProfile.sonsWhoWantToBeAdded.filter(s => !s.equals(sonid));
            let sonProfile = await SonProfile.findById(sonid);
            sonProfile.parentsFriends.parentsFriendsArray.push(id);
            sonProfile.parentsWithRequestSent = sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !p.equals(id));
            await parentProfile.save();
            await sonProfile.save();
            return res.json({"message": "This son was added to your Friends List"});
        } else {
            return res.json({"message": "This man is not on your 'Want to be added' list"});
        }
    } catch (e) {
        console.log(e.message);
        return res.json({ "message": "Something went wrong" });
    }
}