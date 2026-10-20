const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const SonProfile = require('./models/sonProfile');
const ParentProfile = require('./models/parentProfile');

/**
 * Minimalist Custom Mongoose Store for express-rate-limit
 */
class MongooseStore {
    constructor() {
        this.windowMs = 15 * 60 * 1000; // Default fallback

        // Define a lightweight schema for rate limits if it doesn't already exist
        const rateLimitSchema = new mongoose.Schema({
            key: { type: String, required: true, unique: true },
            totalHits: { type: Number, required: true, default: 0 },
            resetTime: { type: Date, required: true }
        });

        // TTL index ensures MongoDB automatically purges expired records
        rateLimitSchema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });

        // Prevent OverwriteModelError if model is compiled multiple times
        this.Model = mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema);
    }

    // Called automatically by express-rate-limit during initialization
    init(options) {
        this.windowMs = options.windowMs;
    }

    // Called on every request to increment the IP/client counter
    async increment(key) {
        const now = new Date();
        let record = await this.Model.findOne({ key });

        // If no record exists or the previous window has expired, start a fresh window
        if (!record || record.resetTime <= now) {
            const resetTime = new Date(now.getTime() + this.windowMs);
            record = await this.Model.findOneAndUpdate(
                { key },
                { totalHits: 1, resetTime },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } else {
            // Otherwise, atomically increment the hit count
            record = await this.Model.findOneAndUpdate(
                { key, resetTime: record.resetTime },
                { $inc: { totalHits: 1 } },
                { new: true }
            );

            // Handle race conditions if resetTime shifted concurrently
            if (!record) {
                return this.increment(key);
            }
        }

        return {
            totalHits: record.totalHits,
            resetTime: record.resetTime
        };
    }

    // Optional: Decrement count if skipSuccessfulRequests/skipFailedRequests is used
    async decrement(key) {
        await this.Model.findOneAndUpdate(
            { key },
            { $inc: { totalHits: -1 } }
        );
    }

    // Optional: Reset specific key manually
    async resetKey(key) {
        await this.Model.deleteOne({ key });
    }
}

// Authentication Middleware
module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        return res.json({'error': 'You must be logged in'});
    }
    next();
};

// Profile Ownership Middleware
module.exports.isProfileOwner = function (options) {
    return async function (req, res, next) {
        let isOwner = false;
        
        switch (options.type) {
            case 'son': {
                const foundSon = await SonProfile.findById(req.params.id).populate({
                    path: 'owner',
                    select: '_id'
                });
                isOwner = foundSon && foundSon.owner?._id?.equals(req.user._id);
                break;
            }
            case 'parent': {
                const foundParent = await ParentProfile.findById(req.params.id).populate({
                    path: 'owner',
                    select: '_id'
                });
                isOwner = foundParent && foundParent.owner?._id?.equals(req.user._id);
                break;
            }
            default:
                return res.json({'error': 'We have some technical difficulties'});
        }

        if (isOwner) {
            next();
        } else {
            return res.json({'error': 'You are not the owner of this profile'});
        }
    };
};

// Email Verification Middleware
module.exports.isEmailVerified = (req, res, next) => {
    if (req.isAuthenticated() && !req.user.isVerified) {
        return res.status(403).json({ error: 'Please verify your email address first.' });
    }
    next();
};

// Rate Limiter using our Custom Mongoose Store
module.exports.emailIpRateLimiter = rateLimit({
    store: new MongooseStore(),
    windowMs: 15 * 60 * 1000, // 15 minutes window
    limit: 10, // Max 10 requests per windowMs
    standardHeaders: 'draft-8', 
    legacyHeaders: false, 
    message: {
        error: 'Too many requests from this IP address. Please try again after 15 minutes.'
    },
    passOnStoreError: true 
});