const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const AddressSchema = require('./address');
const SocialMediaSchema = require('./socialMedia');

const ImageSchema = new Schema({
    url: String,
    filename: String
});

const SonProfileSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    fullName: {
        type: String,
        maxlength: [100, 'Full name cannot exceed 100 characters'],
        validate: {
            validator: function (v) {
                if (!v) return true;
                return !/\d/.test(v);
            },
            message: 'Full name cannot contain numbers'
        }
    },
    dateOfBirth: {
        type: Date,
        validate: {
            validator: function (v) {
                if (!v) return true;
                const today = new Date();
                const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
                return v <= minAgeDate;
            },
            message: 'User must be at least 18 years old'
        }
    },
    address: AddressSchema,
    aboutYou: {
        type: String,
        maxlength: [1000, 'About section cannot exceed 1000 characters']
    },
    image: ImageSchema,
    dateWhenImageLastUpdated: Date,
    job: {
        position: {
            type: String,
            maxlength: [200, 'Job position cannot exceed 200 characters']
        },
        location: AddressSchema,
        companyName: {
            type: String,
            maxlength: [200, 'Company name cannot exceed 200 characters']
        }
    },
    education: {
        schoolName: {
            type: String,
            maxlength: [200, 'School name cannot exceed 200 characters']
        },
        educationLevel: {
            type: String,
            maxlength: [200, 'Education level cannot exceed 200 characters']
        },
        field: {
            type: String,
            maxlength: [200, 'Field of study cannot exceed 200 characters']
        }
    },
    socialMedia: [SocialMediaSchema],
    parentsFriends: {
        dateWhenLastParentAdded: Date,
        parentsFriendsArray: {
            type: [
                {
                    parent: {
                        type: Schema.Types.ObjectId,
                        ref: 'ParentProfile',
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
                message: 'parentsFriendsArray cannot contain more than 5 objects'
            }
        }
    },
    parentsSaved: {
        type: [
            {
                type: Schema.Types.ObjectId,
                ref: 'ParentProfile'
            }
        ],
        default: []
    },
    parentsWhoWantToBeAdded: {
        type: [
            {
                parent: {
                    type: Schema.Types.ObjectId,
                    ref: 'ParentProfile',
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
    parentsWithRequestSent: {
        dateWhenLastRequestWasSent: Date,
        parentsWithRequestSentArray: [
            {
                type: Schema.Types.ObjectId,
                ref: 'ParentProfile'
            }
        ]
    }
});

module.exports = mongoose.model('SonProfile', SonProfileSchema);