const moment = require('moment');
const User = require('../models/user');
const SonProfile = require('../models/sonProfile');

module.exports.index = async (req, res) => {
    const { ageMin = 18, ageMax = 99, city = '.*' } = req.query;
    const dateMax = moment().subtract(ageMin, 'years').format('YYYY-MM-DD');
    const dateMin = moment().subtract(ageMax, 'years').format('YYYY-MM-DD');
    const sons = await SonProfile.find({ dateOfBirth: { $gte: dateMin, $lte: dateMax }, "address.city": { $regex: `${city}`, $options: 'i' } }, 'dateOfBirth address job image fullName');
    res.json(sons);
}

module.exports.showSon = async (req, res) => {
    const son = await SonProfile.findById(req.params.id, 'dateOfBirth address job education aboutYou image socialMedia fullName');
    res.json(son);
}

module.exports.register = async (req, res, next) => {
    const { email, password, name, surname, dateOfBirth, address, aboutYou, images, job, education, organizations, hobbies, socialMedia } = req.body;
    const user = new User({ email, name, role: 'son' });
    let registeredUser = {};
    try {
        registeredUser = await User.register(user, password);
    } catch (e) {
        return res.send("There is such a user.");
    }
    if (Object.keys(registeredUser).length !== 0) {
        const sonProfile = new SonProfile({
            owner: registeredUser._id,
            job,
            surname,
            dateOfBirth,
            aboutYou,
            hobbies,
            address,
            images,
            education,
            organizations,
            socialMedia
        });
        try {
            sonProfile.save();
        } catch (e) {
            console.log(e);
        }
        req.login(registeredUser, err => {
            if (err) return next(err);
            return res.json({ "message": 'You are alrady logged in!', "userId": registeredUser._id });
        })
    }
}

module.exports.updateSon = async (req, res, next) => {
    const { id } = req.params;
    try {
        const sonProfile = await SonProfile.findByIdAndUpdate(id, { ...req.body });
        await sonProfile.save();
    } catch (e) {
        return res.json({ "message": "There was some issue with updating your profile" });
    }
    return res.json({ "message": "Your profile has beed updated!" });
}