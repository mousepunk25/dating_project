const mongoose = require('mongoose');
const SonProfile = require('../models/sonProfile');
const ParentProfile = require('../models/parentProfile');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
require('dotenv').config({ path: '../.env' });

const dbUrl = process.env.ENVIRONMENT_VERSION === 'dev'
    ? 'mongodb://localhost:27017/project'
    : `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@datingproject.ktsayaf.mongodb.net/?appName=DatingProject`;

mongoose.connect(dbUrl);

const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const sampleMessages = [
    "Hey! Great connecting with you here.",
    "Hello! How is your day going?",
    "Thanks for adding me to your friends list!",
    "Are you free to chat sometime today?",
    "Looking forward to getting to know you better."
];

(async () => {
    try {
        // Optional: clear existing conversations & messages to avoid duplicates
        await Conversation.deleteMany({});
        await Message.deleteMany({});

        const parents = await ParentProfile.find({});

        for (let p of parents) {
            const parentId = p._id;
            const parentOwnerId = p.owner;

            // Get friends list for this parent
            const friends = p.sonsFriends?.sonsFriendsArray || [];

            for (let sonId of friends) {
                // Fetch SonProfile to get owner ID for messages
                const sonProfile = await SonProfile.findById(sonId);
                if (!sonProfile) continue;

                const sonOwnerId = sonProfile.owner;

                // Check if a conversation already exists between this parent and son
                let conversation = await Conversation.findOne({
                    participantParent: parentId,
                    participantSon: sonId
                });

                if (!conversation) {
                    conversation = new Conversation({
                        participantParent: parentId,
                        participantSon: sonId
                    });
                    await conversation.save();
                }

                // Generate 2-4 random messages per conversation
                const messageCount = Math.floor(Math.random() * 3) + 2;
                let lastCreatedMessage = null;

                for (let j = 0; j < messageCount; j++) {
                    // Alternate sender between parent's User ID and son's User ID
                    const senderId = j % 2 === 0 ? parentOwnerId : sonOwnerId;
                    const randomText = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

                    const message = new Message({
                        conversationId: conversation._id,
                        sender: senderId,
                        text: randomText,
                        readBy: [senderId]
                    });

                    await message.save();
                    lastCreatedMessage = message;
                }

                // Update Conversation with the last message
                if (lastCreatedMessage) {
                    conversation.lastMessage = lastCreatedMessage._id;
                    await conversation.save();
                }
            }
        }

        console.log("Conversations and messages seeded successfully!");
    } catch (e) {
        console.error("Error seeding conversations:", e);
    } finally {
        db.close();
    }
})();