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

module.exports.count = async (req, res) => {
  const sonNumber = await SonProfile.countDocuments({});
  res.json({ "sonNumber": sonNumber });
}