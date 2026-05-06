const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const {isLoggedIn, isProfileOwner} = require('../middleware');
const sons = require('../controllers/sons');

router.get('/', catchAsync(sons.index));

router.route('/:id')
    .get(catchAsync(sons.showSon))
    .delete(isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.deleteSon))


router.route('/register')
.post(catchAsync(sons.register));

router.put('/edit/:id', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.updateSon));

module.exports = router;