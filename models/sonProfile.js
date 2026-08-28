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
    // Requirement 1: Max 100 characters and no numbers
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
    // Requirement 2: Must be at least 18 years old
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
    // Requirement 3: Max 1000 characters
    aboutYou: {
        type: String,
        maxlength: [1000, 'About section cannot exceed 1000 characters']
    },
    image: ImageSchema,
    dateWhenImageLastUpdated: Date, // Tracked timestamp for monthly image changes
    job: {
        // Requirement 4: Max 200 characters
        position: {
            type: String,
            maxlength: [200, 'Job position cannot exceed 200 characters']
        },
        location: AddressSchema,
        // Requirement 5: Max 200 characters
        companyName: {
            type: String,
            maxlength: [200, 'Company name cannot exceed 200 characters']
        }
    },
    education: {
        // Requirement 6: Max 200 characters
        schoolName: {
            type: String,
            maxlength: [200, 'School name cannot exceed 200 characters']
        },
        // Requirement 7: Max 200 characters
        educationLevel: {
            type: String,
            maxlength: [200, 'Education level cannot exceed 200 characters']
        },
        // Requirement 8: Max 200 characters
        field: {
            type: String,
            maxlength: [200, 'Field of study cannot exceed 200 characters']
        }
    },
    socialMedia: [SocialMediaSchema],
    parentsFriends: {
        dateWhenLastParentAdded: Date,
        // Requirement 9: Max 5 objects in parentsFriendsArray
        parentsFriendsArray: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: 'ParentProfile'
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
                type: Schema.Types.ObjectId,
                ref: 'ParentProfile'
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

SonProfileSchema.pre('save', async function () {
    const now = Date.now();

    // 1. Image Update Limit (Once every 30 days)
    if (this.isModified('image')) {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const lastImageUpdate = this.dateWhenImageLastUpdated
            ? new Date(this.dateWhenImageLastUpdated).getTime()
            : 0;

        if (lastImageUpdate > 0 && (now - lastImageUpdate) < THIRTY_DAYS_MS) {
            const daysRemaining = Math.ceil((THIRTY_DAYS_MS - (now - lastImageUpdate)) / (1000 * 60 * 60 * 24));
            throw new Error(`Profile image can only be changed once a month. Please wait ${daysRemaining} more day(s).`);
        }

        this.dateWhenImageLastUpdated = new Date(now);
    }

    // 2. Enforce 22-hour combined cooldown for adding a parent or sending a request
    const TWENTY_TWO_HOURS_MS = 22 * 60 * 60 * 1000;
    const isFriendsModified = this.isModified('parentsFriends.parentsFriendsArray');
    const isRequestsModified = this.isModified('parentsWithRequestSent.parentsWithRequestSentArray');

    if (isFriendsModified || isRequestsModified) {
        const lastParentAdded = this.parentsFriends?.dateWhenLastParentAdded
            ? new Date(this.parentsFriends.dateWhenLastParentAdded).getTime()
            : 0;

        const lastRequestSent = this.parentsWithRequestSent?.dateWhenLastRequestWasSent
            ? new Date(this.parentsWithRequestSent.dateWhenLastRequestWasSent).getTime()
            : 0;

        const latestActionTime = Math.max(lastParentAdded, lastRequestSent);

        if (latestActionTime > 0 && (now - latestActionTime) < TWENTY_TWO_HOURS_MS) {
            const remainingHours = ((TWENTY_TWO_HOURS_MS - (now - latestActionTime)) / (1000 * 60 * 60)).toFixed(1);
            throw new Error(`You can only send a request or add a friend once every 22 hours. Please wait ${remainingHours} more hour(s).`);
        }

        if (isFriendsModified) {
            if (!this.parentsFriends) this.parentsFriends = {};
            this.parentsFriends.dateWhenLastParentAdded = new Date(now);
        }
        if (isRequestsModified) {
            if (!this.parentsWithRequestSent) this.parentsWithRequestSent = {};
            this.parentsWithRequestSent.dateWhenLastRequestWasSent = new Date(now);
        }
    }
});

module.exports = mongoose.model('SonProfile', SonProfileSchema);