const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ConversationSchema = new Schema({
    participantParent: {
        type: Schema.Types.ObjectId,
        ref: 'ParentProfile',
        required: true
    },
    participantSon: {
        type: Schema.Types.ObjectId,
        ref: 'SonProfile',
        required: true
    },
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
    }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', ConversationSchema);