const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const {isLoggedIn, isProfileOwner} = require('../middleware');
const parents = require('../controllers/parents');

router.get('/', isLoggedIn, catchAsync(parents.index));

router.route('/:id')
    .get(isLoggedIn, catchAsync(parents.showParent))
    .delete(isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.deleteParent));

router.route('/register')
.post(catchAsync(parents.register));

router.put('/edit/:id', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.updateParent));

router.get('/:id/sonswithrequestsent', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWithRequestSentShow));
router.post('/:id/sonswithrequestsent/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWithRequestSentRegister));
router.delete('/:id/sonswithrequestsent/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWithRequestSentDelete));

router.get('/:id/sonswhowanttobeadded', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWhoWantToBeAddedShow));
router.post('/:id/sonswhowanttobeadded/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWhoWantToBeAddedAccept));

module.exports = router;