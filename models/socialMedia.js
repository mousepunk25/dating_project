const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SocialMediaSchema = new Schema({
    website: String,
    url: String
})

module.exports = SocialMediaSchema;