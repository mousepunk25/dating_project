const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');

const SonProfile = require('./models/sonProfile');
const ParentProfile = require('./models/parentProfile');

const dbUrl = process.env.ENVIRONMENT_VERSION === 'dev' ? 'mongodb://localhost:27017/project' : `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@datingproject.ktsayaf.mongodb.net/?appName=DatingProject`;

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

module.exports.isEmailVerified = (req, res, next) => {
    if (req.isAuthenticated() && !req.user.isVerified) {
        return res.status(403).json({ error: 'Please verify your email address first.' });
    }
    next();
};

// Rate limiter for authorization/email-sending routes
module.exports.emailIpRateLimiter = rateLimit({
    store: new MongoStore({
        uri: dbUrl, // Your MongoDB connection string
        collectionName: 'rateLimits', // MongoDB collection name for storing IP limits
        expireTimeMs: 15 * 60 * 1000, // Keep records for 15 minutes before auto-deleting
        errorHandler: (req, res, next, error) => {
            console.error('Rate Limit Store Error:', error);
            next(); // Allow request through if MongoDB store fails (fail-open strategy)
        }
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 10, // Limit each IP to 10 requests per windowMs
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: {
        error: 'Too many requests from this IP address. Please try again after 15 minutes.'
    }
});