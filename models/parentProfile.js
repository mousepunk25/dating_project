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

module.exports = mongoose.model('ParentProfile', ParentSchema);