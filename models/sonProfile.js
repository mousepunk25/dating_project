const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AddressSchema = require('./address');
const SocialMediaSchema = require('./socialMedia');

const ImageSchema = new Schema({
    url: String,
    filename: String
})

const SonProfileSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    fullName: String,
    dateOfBirth: Date,
    address: AddressSchema,
    aboutYou: String,
    image: ImageSchema,
    job: {
        position: String,
        location: AddressSchema,
        companyName: String
    },
    education: {
        schoolName: String,
        educationLevel: String,
        field: String
    },
    socialMedia: [SocialMediaSchema],
    parentsFriends: {
        dateWhenLastParentAdded: Date,
        parentsFriendsArray: [
            {
                type: Schema.Types.ObjectId,
                ref: 'ParentProfile',
                dateWhenParentWasAdded: Date
            }
        ]
    },
    parentsSaved: {
        type: [
            {
                type: Schema.Types.ObjectId,
                ref: 'ParentProfile',
                dateWhenParentSaved: Date
            }
        ], default: []
    },
    parentsWhoWantToBeAdded: {
        type: [
            {
                type: Schema.Types.ObjectId,
                ref: 'ParentProfile'
            }
        ], default: []
    },
    parentsWithRequestSent: {
        dateWhenLastRequestWasSent: Date,
        parentsWithRequestSentArray: [
            {
                type: Schema.Types.ObjectId,
                ref: 'ParentProfile',
                dateWhenRequestWasSent: Date
            }
        ]
    }
})

module.exports = mongoose.model('SonProfile', SonProfileSchema);