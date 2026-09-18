const mongoose = require('mongoose');
const User = require('../models/user'); // Register User schema with Mongoose
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

// --- Sample Dialogue Sets for Friends ---
const sampleDialogues = [
    [
        { from: 'parent', text: 'Hello! I saw your profile and thought I should reach out.' },
        { from: 'son', text: 'Hi! Thanks for getting in touch. How are you doing?' },
        { from: 'parent', text: 'Doing well! Are you currently living in the city center?' },
        { from: 'son', text: 'Yes, I am! Really enjoy the area.' }
    ],
    [
        { from: 'son', text: 'Good evening! Hope you are having a pleasant week.' },
        { from: 'parent', text: 'Hello! Thanks, same to you. How is work going?' },
        { from: 'son', text: 'Going great, keeping busy with new projects.' }
    ],
    [
        { from: 'parent', text: 'Hi there! Nice to connect with you.' },
        { from: 'son', text: 'Hello! Nice to meet you as well.' }
    ]
];

function getRandomItems(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

const seedFriendsAndMessages = async () => {
    try {
        console.log('Cleaning existing conversations and messages...');
        await Conversation.deleteMany({});
        await Message.deleteMany({});

        const sons = await SonProfile.find({}).populate('owner');
        const parents = await ParentProfile.find({}).populate('owner');

        if (!sons.length || !parents.length) {
            console.error('Error: You must run seedSons.js and seedParents.js first!');
            mongoose.connection.close();
            return;
        }

        console.log(`Found ${sons.length} sons and ${parents.length} parents. Linking relationships...`);

        // Track relationships in memory to perform direct database updates later
        const parentUpdates = new Map();
        parents.forEach(p => {
            parentUpdates.set(p._id.toString(), {
                sonsFriendsArray: [],
                sonsSaved: [],
                sonsWhoWantToBeAdded: [],
                sonsWithRequestSentArray: []
            });
        });

        let createdConversationsCount = 0;
        let createdMessagesCount = 0;

        for (const son of sons) {
            const candidateParents = getRandomItems(parents, 15);

            // Filter candidate parents to ensure they don't exceed 3 friends
            const availableForFriendship = candidateParents.filter(
                p => parentUpdates.get(p._id.toString()).sonsFriendsArray.length < 3
            );
            const friendsToMake = getRandomItems(availableForFriendship, Math.min(2, availableForFriendship.length));

            const sonFriendsArray = [];
            const now = new Date();

            for (const parent of friendsToMake) {
                const parentData = parentUpdates.get(parent._id.toString());

                // Add to Son's friend array
                sonFriendsArray.push({
                    parent: parent._id,
                    seen: true,
                    addedAt: now
                });

                // Add to Parent's friend memory structure
                parentData.sonsFriendsArray.push({
                    son: son._id,
                    seen: true,
                    addedAt: now
                });

                // --- Create Conversation & Messages ---
                const conversation = new Conversation({
                    participantParent: parent._id,
                    participantSon: son._id
                });
                await conversation.save();
                createdConversationsCount++;

                const dialogue = getRandomItems(sampleDialogues, 1)[0];
                let lastMessageId = null;

                for (const line of dialogue) {
                    const senderUser = line.from === 'parent' ? parent.owner._id : son.owner._id;
                    const recipientUser = line.from === 'parent' ? son.owner._id : parent.owner._id;

                    const message = new Message({
                        conversationId: conversation._id,
                        sender: senderUser,
                        text: line.text,
                        readBy: [senderUser, recipientUser]
                    });
                    await message.save();
                    lastMessageId = message._id;
                    createdMessagesCount++;
                }

                if (lastMessageId) {
                    conversation.lastMessage = lastMessageId;
                    await conversation.save();
                }
            }

            // Saved Parents
            const remainingForSaved = candidateParents.filter(p => !friendsToMake.includes(p));
            const parentsToSave = getRandomItems(remainingForSaved, 3);
            parentsToSave.forEach(p => {
                parentUpdates.get(p._id.toString()).sonsSaved.push(son._id);
            });

            // Pending Friend Requests (Parents wanting to add Son)
            const remainingForWhoWant = remainingForSaved.filter(p => !parentsToSave.includes(p));
            const parentsWhoWant = getRandomItems(remainingForWhoWant, 2);
            const parentsWhoWantToBeAdded = parentsWhoWant.map(p => ({
                parent: p._id,
                seen: Math.random() < 0.5,
                requestedAt: now
            }));

            parentsWhoWant.forEach(p => {
                parentUpdates.get(p._id.toString()).sonsWithRequestSentArray.push(son._id);
            });

            // Sent Requests (Son requested Parent)
            const remainingForSent = remainingForWhoWant.filter(p => !parentsWhoWant.includes(p));
            const parentsWithSentReq = getRandomItems(remainingForSent, 2);

            parentsWithSentReq.forEach(p => {
                parentUpdates.get(p._id.toString()).sonsWhoWantToBeAdded.push({
                    son: son._id,
                    seen: Math.random() < 0.5,
                    requestedAt: now
                });
            });

            // Direct MongoDB Update for SonProfile (Bypasses pre('save') hook)
            await SonProfile.updateOne(
                { _id: son._id },
                {
                    $set: {
                        'parentsFriends.dateWhenLastParentAdded': now,
                        'parentsFriends.parentsFriendsArray': sonFriendsArray,
                        'parentsSaved': parentsToSave.map(p => p._id),
                        'parentsWhoWantToBeAdded': parentsWhoWantToBeAdded,
                        'parentsWithRequestSent.dateWhenLastRequestWasSent': now,
                        'parentsWithRequestSent.parentsWithRequestSentArray': parentsWithSentReq.map(p => p._id)
                    }
                }
            );
        }

        // Direct MongoDB Update for ParentProfiles (Bypasses pre('save') hook)
        const pastDate = new Date(Date.now() - (23 * 60 * 60 * 1000));
        for (const parent of parents) {
            const updates = parentUpdates.get(parent._id.toString());
            await ParentProfile.updateOne(
                { _id: parent._id },
                {
                    $set: {
                        'sonsFriends.dateWhenLastSonAdded': pastDate,
                        'sonsFriends.sonsFriendsArray': updates.sonsFriendsArray,
                        'sonsSaved': updates.sonsSaved,
                        'sonsWhoWantToBeAdded': updates.sonsWhoWantToBeAdded,
                        'sonsWithRequestSent.dateWhenLastRequestWasSent': pastDate,
                        'sonsWithRequestSent.sonsWithRequestSentArray': updates.sonsWithRequestSentArray
                    }
                }
            );
        }

        console.log(`Seeding complete!`);
        console.log(`- Friends and Requests populated for all accounts.`);
        console.log(`- Created ${createdConversationsCount} active conversations.`);
        console.log(`- Created ${createdMessagesCount} total messages.`);

    } catch (err) {
        console.error("Error during relationship and conversation seeding:", err);
    }
};

seedFriendsAndMessages().then(() => {
    mongoose.connection.close();
});