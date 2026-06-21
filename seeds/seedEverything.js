const mongoose = require('mongoose');
const SonProfile = require('../models/sonProfile');
const ParentProfile = require('../models/parentProfile');
require('dotenv').config({path: '../.env'});

const dbUrl = process.env.ENVIRONMENT_VERSION === 'dev' ? 'mongodb://localhost:27017/project' : `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@datingproject.ktsayaf.mongodb.net/?appName=DatingProject`;

mongoose.connect(dbUrl);

const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

(async () => {
    let sons = await SonProfile.find({});
    let parents = await ParentProfile.find({});

    for(let i = 0; i < sons.length; i++) {
        let s = sons[i];
        const min = 0;
        const max = 4;
        const parentsFriendsCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const parentsSavedCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const parentsWhoWantToBeAddedCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const parentsWithRequestSentCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const randomParentsFriends = randomPeopleWithoutRepetition(parentsFriendsCount, ...parents).map(r => r._id).map(r => r._id);;
        const randomParentsSaved = randomPeopleWithoutRepetition(parentsSavedCount, ...parents).map(r => r._id).map(r => r._id);
        const randomParentsWhoWantToBeAdded = randomPeopleWithoutRepetition(parentsWhoWantToBeAddedCount, ...parents).map(r => r._id);
        const randomParentsWithRequestSent = randomPeopleWithoutRepetition(parentsWithRequestSentCount, ...parents).map(r => r._id);
        let parentsToBeAdded = {
            parentsFriends: {dateWhenLastParentAdded: Date.now(), parentsFriendsArray: randomParentsFriends},
            parentsSaved: randomParentsSaved,
            parentsWhoWantToBeAdded: randomParentsWhoWantToBeAdded,
            parentsWithRequestSent: {dateWhenLastRequestWasSent: Date.now(), parentsWithRequestSentArray: randomParentsWithRequestSent}
        };
        try {
            await SonProfile.findByIdAndUpdate(s._id, {...parentsToBeAdded});
        } catch (e) {
            console.log(e);
        }
    }
    for(let i = 0; i < parents.length; i++) {
        let p = parents[i];
        const min = 0;
        const max = 4;
        const sonsFriendsCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const sonsSavedCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const sonsWhoWantToBeAddedCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const sonsWithRequestSentCount = Math.floor(Math.random() * (max - min + 1)) + min;
        const randomSonsFriends = randomPeopleWithoutRepetition(sonsFriendsCount, ...sons).map(r => r._id).map(r => r._id);;
        const randomSonsSaved = randomPeopleWithoutRepetition(sonsSavedCount, ...sons).map(r => r._id).map(r => r._id);
        const randomSonsWhoWantToBeAdded = randomPeopleWithoutRepetition(sonsWhoWantToBeAddedCount, ...sons).map(r => r._id);
        const randomSonsWithRequestSent = randomPeopleWithoutRepetition(sonsWithRequestSentCount, ...sons).map(r => r._id);
        let sonsToBeAdded = {
            sonsFriends: {dateWhenLastSonAdded: Date.now(), sonsFriendsArray: randomSonsFriends},
            sonsSaved: randomSonsSaved,
            sonsWhoWantToBeAdded: randomSonsWhoWantToBeAdded,
            sonsWithRequestSent: {dateWhenLastRequestWasSent: Date.now(), sonsWithRequestSentArray: randomSonsWithRequestSent}
        };
        try {
            await ParentProfile.findByIdAndUpdate(p._id, {...sonsToBeAdded});
        } catch (e) {
            console.log(e);
        }
    }
    db.close();
})()

function randomPeopleWithoutRepetition(n, ...data) {
    let randomValues = [];
    for (let i = 0; i < n; i++) {
        const randomValue = data.splice(Math.floor(Math.random() * data.length), 1);
        randomValues.push(randomValue[0]);
    }
    return randomValues;
}