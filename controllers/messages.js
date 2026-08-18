const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const ParentProfile = require('../models/ParentProfile');
const SonProfile = require('../models/SonProfile');

module.exports.sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { text } = req.body;
        const senderUserId = req.user._id;

        if (!text || text.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Message text cannot be empty.'
            });
        }

        // 1. Locate current user's profile (Parent or Son)
        const foundParent = await ParentProfile.findOne({ owner: senderUserId });
        const foundSon = !foundParent ? await SonProfile.findOne({ owner: senderUserId }) : null;

        const parentId = foundParent ? foundParent._id : null;
        const sonId = foundSon ? foundSon._id : null;

        if (!parentId && !sonId) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found.'
            });
        }

        // 2. Verify conversation exists and sender is a participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            $or: [
                ...(parentId ? [{ participantParent: parentId }] : []),
                ...(sonId ? [{ participantSon: sonId }] : [])
            ]
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found or access denied.'
            });
        }

        // 3. Create and save the new message
        const newMessage = new Message({
            conversationId,
            sender: senderUserId, // Keeps reference to the User model ID
            text: text.trim(),
            readBy: [senderUserId]
        });

        await newMessage.save();

        // 4. Update Conversation's lastMessage reference and timestamp
        conversation.lastMessage = newMessage._id;
        await conversation.save();

        return res.status(201).json({
            success: true,
            message: newMessage
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send message.'
        });
    }
};