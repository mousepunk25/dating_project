const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const Admin = require('../models/admin');
const admins = require('../controllers/admins');

router.route('/register')
.post(catchAsync(admins.register));

module.exports = router;