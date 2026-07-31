const { query } = require('express-validator');

const User = require('../models/user');
const ParentProfile = require('../models/parentProfile');
const SonProfile = require('../models/sonProfile');

// 1. Define validation rules
module.exports.validateIndex = [
  query('sonAgeMin')
    .optional()
    .isInt({ min: 18, max: 99 })
    .withMessage('sonAgeMin must be an integer between 18 and 99')
    .toInt(), // Converts input string to integer

  query('sonAgeMax')
    .optional()
    .isInt({ min: 18, max: 99 })
    .withMessage('sonAgeMax must be an integer between 18 and 99')
    .custom((value, { req }) => {
      const min = req.query.sonAgeMin ? parseInt(req.query.sonAgeMin, 10) : 18;
      if (parseInt(value, 10) <= min) {
        throw new Error('sonAgeMax must be greater than sonAgeMin');
      }
      return true;
    })
    .toInt(),

  query('city')
    .optional()
    .isString()
    .withMessage('city must be a string')
    .trim()
];

module.exports.index = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Parse defaults if query parameters weren't provided
  const sonAgeMin = req.query.sonAgeMin ?? 18;
  const sonAgeMax = req.query.sonAgeMax ?? 99;
  const city = req.query.city ?? '.*';

  try {
    const parents = await ParentProfile.find(
      {
        "sonAgeMin": { $gte: sonAgeMin },
        "sonAgeMax": { $lte: sonAgeMax },
        "address.city": { $regex: city, $options: 'i' }
      },
      'name address job'
    );

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
            return res.json({
                "message": "This man was added to your friend's list.",
                "status": 200
            })
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

module.exports.sonsFriendsShow = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate({
            path: 'sonsFriends',
            populate: {path: 'sonsFriendsArray'}
        });
        const sonsList =  parent.sonsFriends.sonsFriendsArray;
        return res.json(sonsList);
    } catch (e) {
        console.log(e.message);
        return res.json({'message': 'Something went wrong.'});
    }
}

module.exports.sonsSavedShow = async (req, res, next) => {
    try {
        const parent = await ParentProfile.findById(req.params.id).populate('sonsSaved');
        const sonsList =  parent.sonsSaved;
        return res.json(sonsList);
    } catch (e) {
        console.log(e.message);
        return res.json({'message': 'Something went wrong.'});
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
            return res.json({"message": "This man is already saved"});
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