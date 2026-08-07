const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const {isLoggedIn, isProfileOwner} = require('../middleware');
const parents = require('../controllers/parents');

router.get('/', parents.validateIndex, isLoggedIn, catchAsync(parents.index));

router.route('/:id')
    .get(isLoggedIn, catchAsync(parents.showParent))
    .delete(isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.deleteParent));

router.put('/edit/:id', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.updateParent));

router.get('/:id/sonswithrequestsent', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWithRequestSentShow));
router.post('/:id/sonswithrequestsent/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWithRequestSentRegister));
router.delete('/:id/sonswithrequestsent/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWithRequestSentDelete));

router.get('/:id/sonswhowanttobeadded', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWhoWantToBeAddedShow));
router.post('/:id/sonswhowanttobeadded/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWhoWantToBeAddedAccept));
router.delete('/:id/sonswhowanttobeadded/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsWhoWantToBeAddedDelete));

router.get('/:id/sonsfriends', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsFriendsShow));
router.delete('/:id/sonsfriends/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsFriendsDelete));

router.get('/:id/sonssaved', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsSavedShow));
router.post('/:id/sonssaved/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsSavedRegister));
router.delete('/:id/sonssaved/:sonid', isLoggedIn, isProfileOwner({type: 'parent'}), catchAsync(parents.sonsSavedDelete));

module.exports = router;