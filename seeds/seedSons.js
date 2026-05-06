const fs = require('fs');
const { string } = require('joi');
const mongoose = require('mongoose');
const sons = require('./sons');
const imagesSons = require('./images-sons');
const socialMediaSons = require('./socialMedia-sons');
const SonProfile = require('../models/sonProfile');
const User = require('../models/user');

mongoose.connect('mongodb://localhost:27017/project', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
});

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

let completeSons = sons.map(s => {
    let imagesSon = imagesSons.find(is => {
        return is.owner === s.email;
    })
    let foundAddress = randomCity();
    let foundJobLocation = randomCity();
    let organizationsWithLocations = s.organizations.map(o => {
        return ({ ...o, location: randomCity() });
    });
    return ({ ...s, images: imagesSon.images, address: foundAddress, job: { ...s.job, location: foundJobLocation }, organizations: organizationsWithLocations });
});

completeSons = completeSons.map(s => {
    let socialMediaSon = socialMediaSons.find(sM => {
        return sM.owner === s.email;
    })
    return ({ ...s, socialMedia: socialMediaSon.media});
});

const seedDB = async () => {
    await SonProfile.deleteMany({});
    await User.deleteMany({ role: 'son' })
    for(let i = 0; i < completeSons.length; i++) {
        const user = new User({
            email: completeSons[i].email,
            name: completeSons[i].name,
            role: 'son'
        })
        const registeredUser = await User.register(user, completeSons[i].password)
        try {
            await registeredUser.save();
        } catch (e) {
            console.log(e);
        }
        const sonProfile = new SonProfile({...completeSons[i], owner: registeredUser._id});
        try {
        await sonProfile.save();
        } catch (e) {
            console.log(e);
        }
    }
};

seedDB().then(() => {
    db.close();
})


function randomCity() {
    return citiesJsonArray[Math.floor(Math.random() * citiesJsonArray.length)];
}