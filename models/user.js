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
    verificationTokenExpires: Date
});

// Configure Passport to verify the account status during authentication
UserSchema.plugin(passportLocalMongoose, { 
    usernameField: 'email',
    findByUsername: function (model, query) {
        // Enforce email verification check on authentication queries
        query.isVerified = true;
        return model.findOne(query);
    }
});

module.exports = mongoose.model('User', UserSchema);