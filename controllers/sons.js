const { param, query, body, validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const moment = require('moment');

const User = require('../models/user');
const SonProfile = require('../models/sonProfile');
const ParentProfile = require('../models/parentProfile');
const Conversation = require('../models/conversation');

const isEqualId = (a, b) => {
  const idA = (a?.parent?._id || a?.parent || a?._id || a)?.toString();
  const idB = (b?.parent?._id || b?.parent || b?._id || b)?.toString();
  return idA === idB;
};

const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

// Helper to format Mongoose validation/hook errors
const handleSaveError = (res, err) => {
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: messages.join(', ') });
  }
  if (err.message) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'An unexpected database error occurred' });
};

// 1. Index Validation & Endpoint
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
    .escape()
];

module.exports.index = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const ageMin = req.query.ageMin ?? 18;
  const ageMax = req.query.ageMax ?? 100;
  const city = req.query.city ? escapeRegex(req.query.city) : '.*';

  const dateMax = moment().subtract(ageMin, 'years').endOf('day').toDate();
  const dateMin = moment().subtract(ageMax, 'years').startOf('day').toDate();

  let excludedIds = [];
  if (req.cookies?.displayedSonsIds) {
    try {
      const rawCookie = req.cookies.displayedSonsIds;
      const parsedArray = typeof rawCookie === 'string' ? JSON.parse(rawCookie) : rawCookie;

      if (Array.isArray(parsedArray)) {
        excludedIds = parsedArray
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));
      }
    } catch (e) {
      excludedIds = [];
    }
  }

  try {
    const queryMatch = {
      dateOfBirth: { $gte: dateMin, $lte: dateMax },
      "address.city": { $regex: city, $options: 'i' }
    };

    if (excludedIds.length > 0) {
      queryMatch._id = { $nin: excludedIds };
    }

    const sons = await SonProfile.aggregate([
      { $match: queryMatch },
      { $sample: { size: 100 } },
      {
        $project: {
          dateOfBirth: 1,
          address: 1,
          job: 1,
          image: 1,
          fullName: 1
        }
      }
    ]);

    res.status(200).json(sons);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve son profiles.' });
  }
};

module.exports.count = async (req, res) => {
  try {
    const sonNumber = await SonProfile.countDocuments({});
    res.status(200).json({ sonNumber });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count son profiles.' });
  }
};

// 2. Show Son Profile
module.exports.validateShowSon = [
  param('id')
    .exists()
    .withMessage('ID parameter is required')
    .isString()
    .trim()
    .escape()
    .isMongoId()
    .withMessage('Invalid ID format')
];

module.exports.showSon = async (req, res) => {
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

    res.status(200).json(son);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve son profile.' });
  }
};

// 3. Update Son Profile
module.exports.validateUpdateSon = [
  param('id')
    .exists()
    .withMessage('ID parameter is required')
    .isString()
    .trim()
    .escape()
    .isMongoId()
    .withMessage('Invalid ID format'),

  body('fullName').optional().isString().trim().escape(),
  body('job.position').optional().isString().trim().escape(),
  body('job.companyName').optional().isString().trim().escape(),
  body('education.schoolName').optional().isString().trim().escape(),
  body('education.educationLevel').optional().isString().trim().escape(),
  body('aboutYou').optional().isString().trim().escape(),
  body('address.city').optional().isString().trim().escape(),
  body('address.country').optional().isString().trim().escape(),
  body('dateOfBirth').optional().isISO8601().withMessage('dateOfBirth must be a valid YYYY-MM-DD date string')
];

module.exports.updateSon = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const sonProfile = await SonProfile.findById(id);

    if (!sonProfile) {
      return res.status(404).json({ error: 'Son profile not found' });
    }

    const { fullName, aboutYou, dateOfBirth, address, job, education, socialMedia, image } = req.body;

    // Check 30-day image constraint BEFORE uploading to Cloudinary
    if (image && typeof image === 'string' && image.startsWith('data:image')) {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const lastImageUpdate = sonProfile.dateWhenImageLastUpdated
        ? new Date(sonProfile.dateWhenImageLastUpdated).getTime()
        : 0;

      if (lastImageUpdate > 0 && (now - lastImageUpdate) < THIRTY_DAYS_MS) {
        const daysRemaining = Math.ceil((THIRTY_DAYS_MS - (now - lastImageUpdate)) / (1000 * 60 * 60 * 24));
        return res.status(400).json({
          error: `Profile image can only be changed once a month. Please wait ${daysRemaining} more day(s).`
        });
      }

      if (sonProfile.image && sonProfile.image.filename) {
        await cloudinary.uploader.destroy(sonProfile.image.filename);
      }

      const uploadResult = await cloudinary.uploader.upload(image, {
        folder: 'profile_pictures'
      });

      sonProfile.image = {
        url: uploadResult.secure_url,
        filename: uploadResult.public_id
      };
    }

    if (fullName !== undefined) sonProfile.fullName = fullName;
    if (aboutYou !== undefined) sonProfile.aboutYou = aboutYou;
    if (dateOfBirth !== undefined) sonProfile.dateOfBirth = dateOfBirth;
    if (address !== undefined) sonProfile.address = address;
    if (job !== undefined) sonProfile.job = job;
    if (education !== undefined) sonProfile.education = education;
    if (socialMedia !== undefined) sonProfile.socialMedia = socialMedia;

    await sonProfile.save();

    return res.status(200).json({
      message: 'Profile updated successfully!',
      profile: sonProfile
    });
  } catch (e) {
    return handleSaveError(res, e);
  }
};

// 4. Friend Requests Sent
module.exports.parentsWithRequestSentShow = async (req, res) => {
  try {
    const son = await SonProfile.findById(req.params.id).populate('parentsWithRequestSent.parentsWithRequestSentArray');

    if (!son) {
      return res.status(404).json({ error: 'Son profile not found' });
    }

    return res.status(200).json(son.parentsWithRequestSent?.parentsWithRequestSentArray || []);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch sent requests.' });
  }
};

module.exports.parentsWithRequestSentRegister = async (req, res) => {
  const { id, parentid } = req.params;

  try {
    const sonProfile = await SonProfile.findById(id);
    const parentProfile = await ParentProfile.findById(parentid);

    if (!sonProfile || !parentProfile) {
      return res.status(404).json({ error: 'Son or Parent profile not found.' });
    }

    const isParentFriend = sonProfile.parentsFriends?.parentsFriendsArray?.some(pF => isEqualId(pF, parentid));
    const isParentWithRequestSent = sonProfile.parentsWithRequestSent?.parentsWithRequestSentArray?.some(pW => isEqualId(pW, parentid));
    const isParentWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded?.some(pW => isEqualId(pW, parentid));

    if (isParentFriend) {
      return res.status(409).json({ error: 'This parent is already on your friends list.' });
    }

    if (isParentWithRequestSent) {
      return res.status(409).json({ error: 'You have already sent a request to this parent.' });
    }

    // Mutual addition branch
    if (isParentWhoWantToBeAdded) {
      sonProfile.parentsFriends.parentsFriendsArray.push({ parent: parentid });
      sonProfile.parentsWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded.filter(s => !isEqualId(s, parentid));

      parentProfile.sonsFriends.sonsFriendsArray.push({ son: id });
      parentProfile.sonsWithRequestSent.sonsWithRequestSentArray = 
        parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.filter(s => !isEqualId(s, id));

      let conversation = await Conversation.findOne({ participantParent: parentid, participantSon: id });
      if (!conversation) {
        conversation = new Conversation({ participantParent: parentid, participantSon: id });
        await conversation.save();
      }

      await sonProfile.save();
      await parentProfile.save();

      return res.status(200).json({
        message: 'Mutual connection made! Parent added to friends list.',
        conversationId: conversation._id
      });
    }

    // Standard Request Path
    sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.push(parentid);
    parentProfile.sonsWhoWantToBeAdded.push({ son: id });

    await parentProfile.save();
    await sonProfile.save();

    return res.status(200).json({ message: 'Friend request sent successfully.' });
  } catch (e) {
    return handleSaveError(res, e);
  }
};

module.exports.parentsWithRequestSentDelete = async (req, res) => {
  const { id, parentid } = req.params;
  try {
    const sonProfile = await SonProfile.findById(id);
    const parentProfile = await ParentProfile.findById(parentid);

    if (!sonProfile || !parentProfile) {
      return res.status(404).json({ error: 'Son or Parent profile not found.' });
    }

    sonProfile.parentsWithRequestSent.parentsWithRequestSentArray = 
      sonProfile.parentsWithRequestSent.parentsWithRequestSentArray.filter(p => !isEqualId(p, parentid));

    parentProfile.sonsWhoWantToBeAdded = 
      parentProfile.sonsWhoWantToBeAdded.filter(s => !isEqualId(s, id));

    await sonProfile.save();
    await parentProfile.save();

    return res.status(200).json({ message: 'Request canceled successfully.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to cancel the request.' });
  }
};

// 5. Friend Requests Received
module.exports.parentsWhoWantToBeAddedShow = async (req, res) => {
  try {
    const son = await SonProfile.findById(req.params.id).populate('parentsWhoWantToBeAdded.parent');
    if (!son) {
      return res.status(404).json({ error: 'Son profile not found' });
    }

    const requestsList = son.parentsWhoWantToBeAdded || [];

    // Mark unread incoming requests as seen
    if (requestsList.some(item => !item.seen)) {
      await SonProfile.updateOne(
        { _id: req.params.id },
        { $set: { "parentsWhoWantToBeAdded.$[].seen": true } }
      );
      requestsList.forEach(item => { item.seen = true; });
    }

    return res.status(200).json(requestsList);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch incoming requests.' });
  }
};

module.exports.parentsWhoWantToBeAddedAccept = async (req, res) => {
  const { id, parentid } = req.params;
  try {
    const sonProfile = await SonProfile.findById(id);
    const parentProfile = await ParentProfile.findById(parentid);

    if (!sonProfile || !parentProfile) {
      return res.status(404).json({ error: 'Son or Parent profile not found.' });
    }

    const isParentFriend = sonProfile.parentsFriends?.parentsFriendsArray?.some(pF => isEqualId(pF, parentid));
    const isParentWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded?.some(pW => isEqualId(pW, parentid));

    if (isParentFriend) {
      return res.status(409).json({ error: 'This parent is already on your friends list.' });
    }

    if (!isParentWhoWantToBeAdded) {
      return res.status(400).json({ error: 'This parent is not on your pending requests list.' });
    }

    sonProfile.parentsFriends.parentsFriendsArray.push({ parent: parentid });
    sonProfile.parentsWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded.filter(s => !isEqualId(s, parentid));

    parentProfile.sonsFriends.sonsFriendsArray.push({ son: id });
    parentProfile.sonsWithRequestSent.sonsWithRequestSentArray = 
      parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.filter(p => !isEqualId(p, id));

    let conversation = await Conversation.findOne({ participantParent: parentid, participantSon: id });
    if (!conversation) {
      conversation = new Conversation({ participantParent: parentid, participantSon: id });
      await conversation.save();
    }

    await sonProfile.save();
    await parentProfile.save();

    return res.status(200).json({
      message: 'Parent added to your friends list.',
      conversationId: conversation._id
    });
  } catch (e) {
    return handleSaveError(res, e);
  }
};

module.exports.parentsWhoWantToBeAddedDelete = async (req, res) => {
  const { id, parentid } = req.params;
  try {
    const sonProfile = await SonProfile.findById(id);
    const parentProfile = await ParentProfile.findById(parentid);

    if (!sonProfile || !parentProfile) {
      return res.status(404).json({ error: 'Son or Parent profile not found.' });
    }

    sonProfile.parentsWhoWantToBeAdded = 
      sonProfile.parentsWhoWantToBeAdded.filter(p => !isEqualId(p, parentid));

    parentProfile.sonsWithRequestSent.sonsWithRequestSentArray = 
      parentProfile.sonsWithRequestSent.sonsWithRequestSentArray.filter(s => !isEqualId(s, id));

    await sonProfile.save();
    await parentProfile.save();

    return res.status(200).json({ message: 'Request rejected successfully.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to reject request.' });
  }
};

// 6. Friends List
module.exports.parentsFriendsShow = async (req, res) => {
  try {
    const son = await SonProfile.findById(req.params.id).populate('parentsFriends.parentsFriendsArray.parent');

    if (!son) {
      return res.status(404).json({ error: 'Son profile not found' });
    }

    const friendsList = son.parentsFriends?.parentsFriendsArray || [];

    // Mark unseen added friends as seen
    if (friendsList.some(item => !item.seen)) {
      await SonProfile.updateOne(
        { _id: req.params.id },
        { $set: { "parentsFriends.parentsFriendsArray.$[].seen": true } }
      );
      friendsList.forEach(item => { item.seen = true; });
    }

    return res.status(200).json(friendsList);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch friends list.' });
  }
};

module.exports.parentsFriendsDelete = async (req, res) => {
  const { id, parentid } = req.params;
  try {
    const sonProfile = await SonProfile.findById(id);
    const parentProfile = await ParentProfile.findById(parentid);

    if (!sonProfile || !parentProfile) {
      return res.status(404).json({ error: 'Son or Parent profile not found.' });
    }

    sonProfile.parentsFriends.parentsFriendsArray = 
      sonProfile.parentsFriends.parentsFriendsArray.filter(p => !isEqualId(p, parentid));

    parentProfile.sonsFriends.sonsFriendsArray = 
      parentProfile.sonsFriends.sonsFriendsArray.filter(s => !isEqualId(s, id));

    await Conversation.findOneAndDelete({
      participantParent: parentid,
      participantSon: id
    });

    await sonProfile.save();
    await parentProfile.save();

    return res.status(200).json({ message: 'Parent removed from friends list.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to remove friend.' });
  }
};

// 7. Saved List
module.exports.parentsSavedShow = async (req, res) => {
  try {
    const son = await SonProfile.findById(req.params.id).populate('parentsSaved');
    if (!son) {
      return res.status(404).json({ error: 'Son profile not found' });
    }
    return res.status(200).json(son.parentsSaved || []);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch saved parents list.' });
  }
};

module.exports.parentsSavedRegister = async (req, res) => {
  const { id, parentid } = req.params;
  try {
    const sonProfile = await SonProfile.findById(id);

    if (!sonProfile) {
      return res.status(404).json({ error: 'Son profile not found.' });
    }

    const isParentFriend = sonProfile.parentsFriends?.parentsFriendsArray?.some(pF => isEqualId(pF, parentid));
    const isParentWhoWantToBeAdded = sonProfile.parentsWhoWantToBeAdded?.some(pW => isEqualId(pW, parentid));
    const isParentSaved = sonProfile.parentsSaved?.some(pS => isEqualId(pS, parentid));

    if (isParentFriend) {
      return res.status(409).json({ error: 'This parent is already on your friends list.' });
    }
    if (isParentWhoWantToBeAdded) {
      return res.status(409).json({ error: 'This parent has already sent you a request.' });
    }
    if (isParentSaved) {
      return res.status(409).json({ error: 'This parent is already saved.' });
    }

    sonProfile.parentsSaved.push(parentid);
    await sonProfile.save();

    return res.status(200).json({ message: 'Parent saved successfully.' });
  } catch (e) {
    return handleSaveError(res, e);
  }
};

module.exports.parentsSavedDelete = async (req, res) => {
  const { id, parentid } = req.params;
  try {
    const sonProfile = await SonProfile.findById(id);

    if (!sonProfile) {
      return res.status(404).json({ error: 'Son profile not found.' });
    }

    sonProfile.parentsSaved = sonProfile.parentsSaved.filter(p => !isEqualId(p, parentid));

    await sonProfile.save();

    return res.status(200).json({ message: 'Parent removed from saved list.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to remove parent from saved list.' });
  }
};