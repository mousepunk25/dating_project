const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AddressSchema = require('./address');

const ParentSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    fullName: { type: String, default: "" },
    job: { type: String, default: "" },
    address: { type: AddressSchema, default: {} },
    sonAgeMin: { type: Number, min: 18, max: 94, default: 18 },
    sonAgeMax: { type: Number, min: 23, max: 99, default: 99 },
    sonsFriends: {
        dateWhenLastSonAdded: Date,
        sonsFriendsArray: [
            {
                type: Schema.Types.ObjectId,
                ref: 'SonProfile',
                dateWhenSonWasAdded: Date
            }
        ]
    },
    sonsSaved: {
        type: [
            {
                type: Schema.Types.ObjectId,
                ref: 'SonProfile',
                dateWhenSonSaved: Date
            }
        ], default: []
    },
    sonsWhoWantToBeAdded: {
        type: [
            {
                type: Schema.Types.ObjectId,
                ref: 'SonProfile'
            }
        ], default: []
    },
    sonsWithRequestSent: {
        dateWhenLastRequestWasSent: Date,
        sonsWithRequestSentArray: [
            {
                type: Schema.Types.ObjectId,
                ref: 'SonProfile',
                dateWhenRequestWasSent: Date
            }
        ]
    }
})

module.exports = mongoose.model('ParentProfile', ParentSchema);