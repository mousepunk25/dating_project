const fs = require('fs');
const { string } = require('joi');
const mongoose = require('mongoose');
const parents = require('./parents');
const ParentProfile = require('../models/parentProfile');
const User = require('../models/user');
require('dotenv').config({path: '../.env'});

const dbUrl = process.env.ENVIRONMENT_VERSION === 'dev' ? 'mongodb://localhost:27017/project' : `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@datingproject.ktsayaf.mongodb.net/?appName=DatingProject`;

mongoose.connect(dbUrl);

const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

let cities = [];

cities = fs.readFileSync('cities.csv', 'utf-8', string);
cities = cities.split(/\r?\n/);
cities = cities.map(c => {
    return c.split(',');
});

let citiesJsonArray = [];
var headers = cities[0];
for (var i = 1; i < cities.length; i++) {
    var data = cities[i];
    var obj = {};
    for (var j = 0; j < cities[0].length; j++) {
        if (data[j]) {
            obj[headers[j].trim()] = data[j].trim();
        } else {
            obj[headers[j].trim()] = "";
        }
    }
    citiesJsonArray.push(obj);
};

let completeParents = parents.map(p => {
    let foundAddress = randomCity();
    let sonAgeMin = Math.floor(Math.random() * (94 - 18 + 1)) + 18;
    let sonAgeMax = 0;
    while (sonAgeMax < sonAgeMin) {
        sonAgeMax = Math.floor(Math.random() * (99 - 23 + 1)) +23;
    }
    return ({...p, sonAgeMin: sonAgeMin, sonAgeMax: sonAgeMax, address: foundAddress});
});

const seedDB = async () => {
    await ParentProfile.deleteMany({});
    await User.deleteMany({ role: 'parent' });
    for (let i = 0; i < completeParents.length; i++) {
        const user = new User({
            email: completeParents[i].email,
            role: 'parent'
        })
        const registeredUser = await User.register(user, completeParents[i].password);
        const parentProfile = new ParentProfile({...completeParents[i], owner: registeredUser._id});
        try {
            await parentProfile.save();
        } catch (e) {
            console.log(e);
        }
    }
}

seedDB().then(() => {
    db.close();
})

function randomCity() {
    return citiesJsonArray[Math.floor(Math.random() * citiesJsonArray.length)];
}