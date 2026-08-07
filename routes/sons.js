const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const {isLoggedIn, isProfileOwner} = require('../middleware');
const sons = require('../controllers/sons');

router.get('/', sons.validateIndex, catchAsync(sons.index));

router.get('/count', catchAsync(sons.count));

router.route('/:id')
    .get(sons.validateShowSon, catchAsync(sons.showSon))
    .delete(isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.deleteSon))

router.put('/edit/:id', isLoggedIn, isProfileOwner({type: 'son'}), sons.validateUpdateSon, catchAsync(sons.updateSon));

router.get('/:id/parentswithrequestsent', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsWithRequestSentShow));
router.post('/:id/parentswithrequestsent/:sonid', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsWithRequestSentRegister));
router.delete('/:id/parentswithrequestsent/:sonid', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsWithRequestSentDelete));

router.get('/:id/parentswhowanttobeadded', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsWhoWantToBeAddedShow));
router.post('/:id/parentswhowanttobeadded/:sonid', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsWhoWantToBeAddedAccept));
router.delete('/:id/parentswhowanttobeadded/:sonid', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsWhoWantToBeAddedDelete));

router.get('/:id/parentsfriends', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsFriendsShow));
router.delete('/:id/parentsfriends/:sonid', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsFriendsDelete));

router.get('/:id/parentssaved', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsSavedShow));
router.post('/:id/parentssaved/:sonid', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsSavedRegister));
router.delete('/:id/parentssaved/:sonid', isLoggedIn, isProfileOwner({type: 'son'}), catchAsync(sons.parentsSavedDelete));

module.exports = router;