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
        maxlength: [100, 'Full name cannot exceed 100 characters']
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
                    son: {
                        type: Schema.Types.ObjectId,
                        ref: 'SonProfile',
                        required: true
                    },
                    seen: {
                        type: Boolean,
                        default: false
                    },
                    addedAt: {
                        type: Date,
                        default: Date.now
                    }
                }
            ],
            validate: {
                validator: function (val) {
                    return val.length <= 5;
                },
                message: 'Nie możesz mieć więcej niż 5 znajomych. Usuń któregoś, żeby dodać nowego.'
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
                son: {
                    type: Schema.Types.ObjectId,
                    ref: 'SonProfile',
                    required: true
                },
                seen: {
                    type: Boolean,
                    default: false
                },
                requestedAt: {
                    type: Date,
                    default: Date.now
                }
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

ParentSchema.pre('save', async function () {
    const TWENTY_TWO_HOURS_MS = 22 * 60 * 60 * 1000;
    const now = Date.now();

    const isFriendsModified = this.isModified('sonsFriends.sonsFriendsArray');
    const isRequestsModified = this.isModified('sonsWithRequestSent.sonsWithRequestSentArray');

    if (!isFriendsModified && !isRequestsModified) {
        return;
    }

    // Safely retrieve original array states using Mongoose's internal _atomics or $__ tracking
    const friendsAtom = this.sonsFriends?.sonsFriendsArray?.$atomics();
    const requestsAtom = this.sonsWithRequestSent?.sonsWithRequestSentArray?.$atomics();

    // Check if an ADD operation ($push, $addToSet) took place, or if length increased on a plain array replacement
    const isFriendAdded = isFriendsModified && (
        Boolean(friendsAtom?.$push || friendsAtom?.$addToSet) ||
        (!friendsAtom && this.sonsFriends?.sonsFriendsArray?.length > (this.$__.priorDoc?.sonsFriends?.sonsFriendsArray?.length || 0))
    );

    const isRequestAdded = isRequestsModified && (
        Boolean(requestsAtom?.$push || requestsAtom?.$addToSet) ||
        (!requestsAtom && this.sonsWithRequestSent?.sonsWithRequestSentArray?.length > (this.$__.priorDoc?.sonsWithRequestSent?.sonsWithRequestSentArray?.length || 0))
    );

    // Only apply rate-limiting when adding an item
    if (isFriendAdded || isRequestAdded) {
        const lastFriendAdded = this.sonsFriends?.dateWhenLastSonAdded 
            ? new Date(this.sonsFriends.dateWhenLastSonAdded).getTime() 
            : 0;

        const lastRequestSent = this.sonsWithRequestSent?.dateWhenLastRequestWasSent 
            ? new Date(this.sonsWithRequestSent.dateWhenLastRequestWasSent).getTime() 
            : 0;

        const latestActionTime = Math.max(lastFriendAdded, lastRequestSent);

        if (latestActionTime > 0 && (now - latestActionTime) < TWENTY_TWO_HOURS_MS) {
            const remainingHours = ((TWENTY_TWO_HOURS_MS - (now - latestActionTime)) / (1000 * 60 * 60)).toFixed(1);
            throw new Error(`Możesz WYSŁAĆ lub PRZYJĄĆ zaprosznie raz na 22 godziny. Zaczekaj proszę pozostałe ${remainingHours} godziny.`);
        }

        if (isFriendAdded) {
            if (!this.sonsFriends) this.sonsFriends = {};
            this.sonsFriends.dateWhenLastSonAdded = new Date(now);
        }
        if (isRequestAdded) {
            if (!this.sonsWithRequestSent) this.sonsWithRequestSent = {};
            this.sonsWithRequestSent.dateWhenLastRequestWasSent = new Date(now);
        }
    }
});

module.exports = mongoose.model('ParentProfile', ParentSchema);