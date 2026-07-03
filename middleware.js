const SonProfile = require('./models/sonProfile');
const ParentProfile = require('./models/parentProfile');

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        return res.json({'error': 'You must be logged in'});
    }
    next();
}

module.exports.isProfileOwner = function (options) {
    return async function (req, res, next) {
        let isOwner = false;
        switch(options.type) {
            case 'son':
                const foundSon = await SonProfile.findById(req.params.id).populate({
                    path: 'owner',
                    select: '_id'
                });
                isOwner = foundSon && foundSon.owner._id.equals(req.user._id) ? true : false;
                break;
            case 'parent':
                const foundParent = await ParentProfile.findById(req.params.id).populate({
                    path: 'owner',
                    select: '_id'
                });
                isOwner = foundParent && foundParent.owner._id.equals(req.user._id) ? true : false;
                break;
            default:
                return res.json({'error': 'We have some technical difficulties'});
        }
        if(isOwner) {
            next();
        } else {
            return res.json({'error': 'You are not the owner of this profile'});
        }
    }
}