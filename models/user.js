const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose').default;

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    name: String,
    role: {
        type: String,
        enum: ['admin', 'son']
    }
})

UserSchema.plugin(passportLocalMongoose, {usernameField: 'email'});

module.exports = mongoose.model('User', UserSchema);