const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AddressSchema = require('./address');

const ParentSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    fullName: { 
        type: String, 
        default: "",
        maxlength: [100, 'Full name cannot exceed 100 characters'] // Requirement 1
    },
    job: { type: String, default: "" },
    address: { type: AddressSchema, default: {} },
    sonAgeMin: { type: Number, min: 18, max: 94, default: 18 },
    sonAgeMax: { type: Number, min: 23, max: 100, default: 100 },
    sonsFriends: {
        dateWhenLastSonAdded: Date,
        sonsFriendsArray: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: 'SonProfile'
                }
            ],
            validate: { // Requirement 2
                validator: function (val) {
                    return val.length <= 5;
                },
                message: 'sonsFriendsArray cannot contain more than 5 objects.'
            }
        }
    },
    sonsSaved: {
        type: [
            {
                type: Schema.Types.ObjectId,
                ref: 'SonProfile'
            }
        ], 
        default: []
    },
    sonsWhoWantToBeAdded: {
        type: [
            {
                type: Schema.Types.ObjectId,
                ref: 'SonProfile'
            }
        ], 
        default: []
    },
    sonsWithRequestSent: {
        dateWhenLastRequestWasSent: Date,
        sonsWithRequestSentArray: [
            {
                type: Schema.Types.ObjectId,
                ref: 'SonProfile'
            }
        ]
    }
});

// Requirement 3: Enforce 22-hour combined limit on adding friends or sending requests
ParentSchema.pre('save', async function () {
    const TWENTY_TWO_HOURS_MS = 22 * 60 * 60 * 1000;
    const now = Date.now();

    // Check modification states
    const isFriendsModified = this.isModified('sonsFriends.sonsFriendsArray');
    const isRequestsModified = this.isModified('sonsWithRequestSent.sonsWithRequestSentArray');

    if (isFriendsModified || isRequestsModified) {
        // Read existing timestamps BEFORE mutating them
        const lastFriendAdded = this.sonsFriends?.dateWhenLastSonAdded 
            ? new Date(this.sonsFriends.dateWhenLastSonAdded).getTime() 
            : 0;

        const lastRequestSent = this.sonsWithRequestSent?.dateWhenLastRequestWasSent 
            ? new Date(this.sonsWithRequestSent.dateWhenLastRequestWasSent).getTime() 
            : 0;

        const latestActionTime = Math.max(lastFriendAdded, lastRequestSent);

        // Verify rate limit (22 hours)
        if (latestActionTime > 0 && (now - latestActionTime) < TWENTY_TWO_HOURS_MS) {
            const remainingHours = ((TWENTY_TWO_HOURS_MS - (now - latestActionTime)) / (1000 * 60 * 60)).toFixed(1);
            throw new Error(`You can only send a request or add a friend once every 22 hours. Please wait ${remainingHours} more hour(s).`);
        }

        // Apply new timestamps for tracking
        if (isFriendsModified) {
            if (!this.sonsFriends) this.sonsFriends = {};
            this.sonsFriends.dateWhenLastSonAdded = new Date(now);
        }
        if (isRequestsModified) {
            if (!this.sonsWithRequestSent) this.sonsWithRequestSent = {};
            this.sonsWithRequestSent.dateWhenLastRequestWasSent = new Date(now);
        }
    }
});

module.exports = mongoose.model('ParentProfile', ParentSchema);