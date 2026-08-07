const { param, query, body, validationResult } = require('express-validator');

const moment = require('moment');
const User = require('../models/user');
const SonProfile = require('../models/sonProfile');

const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

// 1. Validation and Sanitization Middleware
module.exports.validateIndex = [
  query('ageMin')
    .optional()
    .isInt({ min: 18 })
    .withMessage('ageMin must be an integer between 18 and 100')
    .toInt(),

  query('ageMax')
    .optional()
    .isInt({ min: 18 })
    .withMessage('ageMax must be an integer between 18 and 100')
    .custom((value, { req }) => {
      const min = req.query.ageMin !== undefined ? parseInt(req.query.ageMin, 10) : 18;
      if (parseInt(value, 10) <= min) {
        throw new Error('ageMax must be greater than ageMin');
      }
      return true;
    })
    .toInt(),

  query('city')
    .optional()
    .isString()
    .withMessage('city must be a string')
    .trim()
    .escape() // XSS Prevention: Sanitizes characters like <, >, &, ', "
];

// 2. Controller Action
module.exports.index = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const ageMin = req.query.ageMin ?? 18;
  const ageMax = req.query.ageMax ?? 100;

  // Clean & safe regex for city query
  const city = req.query.city ? escapeRegex(req.query.city) : '.*';

  // Calculate DOB range
  const dateMax = moment().subtract(ageMin, 'years').format('YYYY-MM-DD');
  const dateMin = moment().subtract(ageMax, 'years').format('YYYY-MM-DD');

  try {
    const sons = await SonProfile.find(
      {
        dateOfBirth: { $gte: dateMin, $lte: dateMax },
        "address.city": { $regex: city, $options: 'i' }
      },
      'dateOfBirth address job image fullName'
    );

    res.json(sons);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports.count = async (req, res) => {
  const sonNumber = await SonProfile.countDocuments({});
  res.json({ "sonNumber": sonNumber });
}

// 1. Validation and Sanitization Middleware
module.exports.validateShowSon = [
  param('id')
    .exists()
    .withMessage('ID parameter is required')
    .isString()
    .withMessage('ID must be a string')
    .trim()
    .escape() // XSS Prevention: Escapes special characters
    .isMongoId()
    .withMessage('Invalid ID format')
];

// 2. Controller Action
module.exports.showSon = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const son = await SonProfile.findById(
      req.params.id,
      'dateOfBirth address job education aboutYou image socialMedia fullName'
    );

    if (!son) {
      return res.status(404).json({ error: 'Son profile not found' });
    }

    res.json(son);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports.deleteSon = async (req, res, next) => {
    try {
        res.json({"message": "This is the route for deleting son"});
    } catch (e) {
        console.log(e);
        return next(err);
    }
}

// 1. Validation and Sanitization Middleware
module.exports.validateUpdateSon = [
  // Validate req.params.id
  param('id')
    .exists()
    .withMessage('ID parameter is required')
    .isString()
    .withMessage('ID must be a string')
    .trim()
    .escape()
    .isMongoId()
    .withMessage('Invalid ID format'),

  // Sanitize & validate fields in req.body
  body('fullName')
    .optional()
    .isString()
    .trim()
    .escape(),

  body('job.position')
    .optional()
    .isString()
    .trim()
    .escape(),

  body('job.companyName')
    .optional()
    .isString()
    .trim()
    .escape(),

  body('education.schoolName')
    .optional()
    .isString()
    .trim()
    .escape(),

  body('education.educationLevel')
    .optional()
    .isString()
    .trim()
    .escape(),

  body('aboutYou')
    .optional()
    .isString()
    .trim()
    .escape(),

  body('address.city')
    .optional()
    .isString()
    .trim()
    .escape(),

  body('address.country')
    .optional()
    .isString()
    .trim()
    .escape(),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('dateOfBirth must be a valid date string (YYYY-MM-DD)')
];

module.exports.updateSon = async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // { new: true, runValidators: true } ensures the updated doc is returned 
    // and schema validators run on update
    const sonProfile = await SonProfile.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!sonProfile) {
      return res.status(404).json({ message: "Son profile not found" });
    }

    return res.json({ message: "Your profile has been updated!" });
  } catch (e) {
    return res.status(500).json({ message: "There was some issue with updating your profile" });
  }
};

module.exports.parentsWithRequestSentShow = async (req, res) => {
    try {
        const son = await SonProfile.findById(req.params.id).populate({
            path: 'parentsWithRequestSent',
            populate: {path: 'parentsWithRequestSentArray'}
        });
        const parentsList =  son.parentsWithRequestSent.parentsWithRequestSentArray;
        return res.json(parentsList);
    } catch (e) {
        console.log(e.message);
        return res.json({'message': 'Something went wrong.'});
    }
}

module.exports.parentsWithRequestSentRegister = async (req, res, next) => {
    const { id, parentid } = req.params;
    try {
        let sonProfile = await SonProfile.findById(id);
        const isParentFriend = sonProfile.parentsFriends.parentsFriendsArray.some(pF => pF.equals(parentid));
        const isParentWithRequestSent = sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.some(pW => pW.equals(parentid));
        const isParentWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded.some(pW => pW.equals(parentid));
        if (isParentFriend) {
            return res.json({ "message": "This parent is already on your friend's list" });
        } else if (isParentWithRequestSent) {
            return res.json({ "message": "You've already sent a request to this parent" });
        } else if (isParentWhoWantToBeAdded) {
            sonProfile.parentsFriends.parentsFriendsArray.push(parentid);
            sonProfile.parentsWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded.filter(s => !s.equals(parentid));
            let parentProfile = await ParentProfile.findById(parentid);
            parentProfile.sonsFriends.sonsFriendsArray.push(id);
            parentProfile.sonsWithRequestSent = parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.filter(s => !s.equals(id));
            await sonProfile.save();
            await parentProfile.save();
            return res.json({ "message": "This parent was on your 'Want To Be Added' list." });
        } else {
            sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.push(parentid);
            await sonProfile.save();
            return res.json({
                "message": "This parent was added to your friend's list.",
                "status": 200
            })
        }
    } catch (e) {
        return res.json({ "message": "Something went wrong" });
    }
}

module.exports.parentsWithRequestSentDelete = async (req, res, next) => {
    const { id, parentid } = req.params;
    try {
        res.json({"message": "This is the route for deleting the parent from the parentsWithRequestSent list"});
    } catch (e) {
        console.log(e);
        return next(err);
    }
}

module.exports.parentsWhoWantToBeAddedShow = async (req, res, next) => {
    try {
        const son = await SonProfile.findById(req.params.id).populate('parentsWhoWantToBeAdded');
        const parentsList =  son.parentsWhoWantToBeAdded;
        return res.json(parentsList);
    } catch (e) {
        console.log(e.message);
        return res.json({'message': 'Something went wrong.'});
    }
}

module.exports.parentsWhoWantToBeAddedAccept = async (req, res, next) => {
    const { id, parentid } = req.params;
    try {
        let sonProfile = await SonProfile.findById(id);
        const isParentFriend = sonProfile.parentsFriends.parentsFriendsArray.some(pF => pF.equals(parentid));
        const isParentWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded.some(pW => pW.equals(parentid));
        if (isParentFriend) {
            return res.json({ "message": "This man is already on your friend's list" });
        } else if (isParentWhoWantToBeAdded) {
            sonProfile.parentsFriends.parentsFriendsArray.push(parentid);
            sonProfile.parentsWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded.filter(s => !s.equals(parentid));
            let parentProfile = await ParentProfile.findById(parentid);
            parentProfile.sonsFriends.sonsFriendsArray.push(id);
            parentProfile.sonsWithRequestSent = parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.filter(p => !p.equals(id));
            await sonProfile.save();
            await parentProfile.save();
            return res.json({"message": "This parent was added to your Friends List"});
        } else {
            return res.json({"message": "This parent is not on your 'Want to be added' list"});
        }
    } catch (e) {
        console.log(e.message);
        return res.json({ "message": "Something went wrong" });
    }
}

module.exports.parentsWhoWantToBeAddedDelete = async (req, res, next) => {
    const { id, parentid } = req.params;
    try {
        res.json({"message": "This is the route for deleting the parent from the parentsWhoWantToBeAdded list"});
    } catch (e) {
        console.log(e);
        return next(err);
    }
}

module.exports.parentsFriendsShow = async (req, res, next) => {
    try {
        const son = await SonProfile.findById(req.params.id).populate({
            path: 'parentsFriends',
            populate: {path: 'parentsFriendsArray'}
        });
        const parentsList =  son.parentsFriends.parentsFriendsArray;
        return res.json(parentsList);
    } catch (e) {
        console.log(e.message);
        return res.json({'message': 'Something went wrong.'});
    }
}

module.exports.parentsFriendsDelete = async (req, res, next) => {
    const { id, parentid } = req.params;
    try {
        res.json({"message": "This is the route for deleting the parent from the parentsFriends list"});
    } catch (e) {
        console.log(e);
        return next(err);
    }
}

module.exports.parentsSavedShow = async (req, res, next) => {
    try {
        const son = await SonProfile.findById(req.params.id).populate('parentsSaved');
        const parentsList =  son.parentsSaved;
        return res.json(parentsList);
    } catch (e) {
        console.log(e.message);
        return res.json({'message': 'Something went wrong.'});
    }
}

module.exports.parentsSavedRegister = async (req, res, next) => {
    const { id, parentid } = req.params;
    try {
        let sonProfile = await SonProfile.findById(id);
        const isParentFriend = sonProfile.parentsFriends.parentsFriendsArray.some(pF => pF.equals(parentid));
        const isParentWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded.some(pW => pW.equals(parentid));
        const isParentSaved = sonProfile.parentsSaved.some(pS => pS.equals(parentid));
        if (isParentFriend) {
            return res.json({ "message": "This man is already on your friend's list" });
        } else if (isParentWhoWantToBeAdded) {
            return res.json({ "message": "This man was on your 'Want To Be Added' list." });
        } else if (isParentSaved) {
            return res.json({"message": "This man is already saved"});
        }
         else {
            sonProfile.parentsSaved.push(parentid);
            await sonProfile.save();
            return res.json({ "message": "This man was added to your saved friend's list." })
        }
    } catch (e) {
        return res.json({
            "message": "Something went wrong",
            "status": 200
        });
    }
}

module.exports.arentsSavedDelete = async (req, res, next) => {
    const { id, parentid } = req.params;
    try {
        res.json({"message": "This is the route for deleting the parent from the parentsSaved list"});
    } catch (e) {
        console.log(e);
        return next(err);
    }
}