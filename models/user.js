const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose').default;

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        maxlength: [400, 'Email cannot exceed 400 characters']
    },
    role: {
        type: String,
        enum: ['admin', 'son', 'parent']
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    // Tracks timestamps of sent emails to enforce 60s cooldown and 4 emails/hour limits
    emailSentHistory: [Date]
});

// Configure Passport to verify the account status during authentication
UserSchema.plugin(passportLocalMongoose, {
    usernameField: 'email',
    findByUsername: function (model, query) {
        query.isVerified = true;
        return model.findOne(query);
    }
});

module.exports = mongoose.model('User', UserSchema);