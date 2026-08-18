const Conversation = require('../models/Conversation');
const SonProfile = require('./models/sonProfile');
const ParentProfile = require('./models/parentProfile');
const Message = require('../models/Message');

module.exports.getUserConversations = async (req, res) => {
    try {
        const currentUserId = req.user._id;

        // 1. Check if the logged-in user has a ParentProfile or SonProfile
        const foundParent = await ParentProfile.findOne({ owner: currentUserId });
        const foundSon = !foundParent ? await SonProfile.findOne({ owner: currentUserId }) : null;

        const parentId = foundParent ? foundParent._id : null;
        const sonId = foundSon ? foundSon._id : null;

        // If neither profile exists, return an empty array early
        if (!parentId && !sonId) {
            return res.status(200).json({
                success: true,
                count: 0,
                conversations: []
            });
        }

        // 2. Query conversations where participantParent IS parentId OR participantSon IS sonId
        const conversations = await Conversation.find({
            $or: [
                ...(parentId ? [{ participantParent: parentId }] : []),
                ...(sonId ? [{ participantSon: sonId }] : [])
            ]
        })
        .populate({
            path: 'participantParent',
            select: 'fullName job address owner'
        })
        .populate({
            path: 'participantSon',
            select: 'fullName job owner'
        })
        .populate({
            path: 'lastMessage',
            select: 'text sender readBy createdAt'
        })
        .sort({ updatedAt: -1 });

        return res.status(200).json({
            success: true,
            count: conversations.length,
            conversations
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve conversations' 
        });
    }
};

module.exports.getSingleConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user._id;

        // 1. Locate the current user's profile (Parent or Son)
        const foundParent = await ParentProfile.findOne({ owner: currentUserId });
        const foundSon = !foundParent ? await SonProfile.findOne({ owner: currentUserId }) : null;

        const parentId = foundParent ? foundParent._id : null;
        const sonId = foundSon ? foundSon._id : null;

        if (!parentId && !sonId) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found.'
            });
        }

        // 2. Fetch conversation & ensure current user's profile is a participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            $or: [
                ...(parentId ? [{ participantParent: parentId }] : []),
                ...(sonId ? [{ participantSon: sonId }] : [])
            ]
        })
        .populate({
            path: 'participantParent',
            select: 'fullName job address owner'
        })
        .populate({
            path: 'participantSon',
            select: 'fullName job owner'
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found or access denied.'
            });
        }

        // 3. Fetch messages belonging to this conversation with pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 30;
        const skip = (page - 1) * limit;

        const messages = await Message.find({ conversationId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Reverse back to chronological order (oldest to newest)
        messages.reverse();

        return res.status(200).json({
            success: true,
            conversation,
            messages,
            page,
            hasMore: messages.length === limit
        });
    } catch (error) {
        console.error('Error fetching single conversation:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve conversation details.'
        });
    }
};