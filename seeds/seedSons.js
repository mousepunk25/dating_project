const mongoose = require('mongoose');
const socialMediaSons = require('./socialMedia-sons');
const SonProfile = require('../models/sonProfile');
const User = require('../models/user');
require('dotenv').config({ path: '../.env' });

const TARGET_SONS_COUNT = 300;

// Hardcoded default image for all generated profiles
const DEFAULT_IMAGE = {
    url: 'https://res.cloudinary.com/gljkxoem/image/upload/v1789737809/profile_pictures/onuqptehvruzxv4z3kp6.jpg',
    filename: 'profile_pictures/onuqptehvruzxv4z3kp6'
};

const dbUrl = process.env.ENVIRONMENT_VERSION === 'dev' 
    ? 'mongodb://localhost:27017/project' 
    : `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@datingproject.ktsayaf.mongodb.net/?appName=DatingProject`;

mongoose.connect(dbUrl);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

// --- Fixed List of 5 Cities ---
const allowedCities = [
    { city: 'Warszawa', country: 'Poland' },
    { city: 'Poznań', country: 'Poland' },
    { city: 'Kraków', country: 'Poland' },
    { city: 'Gdańsk', country: 'Poland' },
    { city: 'Białystok', country: 'Poland' }
];

function getRandomCity() {
    return allowedCities[Math.floor(Math.random() * allowedCities.length)];
}

// --- Data Generators & Helpers ---
const firstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White'];
const jobPositions = ['Software Engineer', 'Product Manager', 'Data Analyst', 'Marketing Specialist', 'Account Executive', 'Architect', 'Financial Analyst', 'Graphic Designer', 'Consultant', 'Retired', 'Business Owner'];
const companies = ['TechCorp', 'Innovate LLC', 'Global Solutions', 'Apex Media', 'Vanguard Systems', 'Nexus Media', 'Horizon Labs', 'Self-Employed'];
const schools = ['State University', 'Institute of Technology', 'National College', 'City University', 'Metropolitan University'];
const educationLevels = ["Bachelor's Degree", "Master's Degree", "Associate Degree", "Doctorate", "High School"];
const fieldsOfStudy = ['Computer Science', 'Business Administration', 'Finance', 'Marketing', 'Mechanical Engineering', 'Psychology', 'Communications'];
const bios = [
    'Passionate about tech, outdoor activities, and spending time with family.',
    'Always eager to learn new things and meet new people. Looking for meaningful connections.',
    'Fitness enthusiast, avid reader, and weekend hiker.',
    'Working hard while enjoying good food, travel, and music.',
    'Optimistic, open-minded, and looking forward to building a bright future.'
];

function getRandomItem(array) {
    if (!array || !array.length) return null;
    return array[Math.floor(Math.random() * array.length)];
}

// Generates a random Date of Birth for ages between 19 and 99
function getRandomDateOfBirth(minAge = 19, maxAge = 99) {
    const today = new Date();
    const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
    const year = today.getFullYear() - age;
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1;
    return new Date(year, month, day);
}

// --- Seed Script ---
const seedDB = async () => {
    try {
        console.log('Cleaning existing son profiles and son user accounts...');
        await SonProfile.deleteMany({});
        await User.deleteMany({ role: 'son' });

        console.log(`Starting to seed ${TARGET_SONS_COUNT} son profiles (ages 19-99, 5 cities, fixed Cloudinary image)...`);

        const thirtyOneDaysAgo = new Date(Date.now() - (31 * 24 * 60 * 60 * 1000));

        for (let i = 1; i <= TARGET_SONS_COUNT; i++) {
            const firstName = getRandomItem(firstNames);
            const lastName = getRandomItem(lastNames);
            const fullName = `${firstName} ${lastName}`;
            const email = `son${i}_${Date.now()}@example.com`;
            const password = 'Password123!';

            // 1. Create and Register User
            const user = new User({
                email: email,
                role: 'son',
                isVerified: true
            });

            const registeredUser = await User.register(user, password);

            // 2. Select social media specs cyclically (or default to empty array)
            const sampleSocial = socialMediaSons && socialMediaSons.length 
                ? socialMediaSons[(i - 1) % socialMediaSons.length].media 
                : [];

            // 3. Create SonProfile using the fixed DEFAULT_IMAGE
            const sonProfile = new SonProfile({
                owner: registeredUser._id,
                fullName: fullName,
                dateOfBirth: getRandomDateOfBirth(19, 99),
                address: getRandomCity(),
                aboutYou: getRandomItem(bios),
                image: DEFAULT_IMAGE,
                dateWhenImageLastUpdated: thirtyOneDaysAgo,
                job: {
                    position: getRandomItem(jobPositions),
                    companyName: getRandomItem(companies),
                    location: getRandomCity()
                },
                education: {
                    schoolName: getRandomItem(schools),
                    educationLevel: getRandomItem(educationLevels),
                    field: getRandomItem(fieldsOfStudy)
                },
                socialMedia: sampleSocial
            });

            await sonProfile.save();

            if (i % 50 === 0 || i === TARGET_SONS_COUNT) {
                console.log(`Seeded ${i}/${TARGET_SONS_COUNT} sons...`);
            }
        }

        console.log('Successfully seeded all 300 son profiles!');
    } catch (err) {
        console.error("Error during database seeding:", err);
    }
};

seedDB().then(() => {
    mongoose.connection.close();
});