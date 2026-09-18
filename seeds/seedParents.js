const mongoose = require('mongoose');
const ParentProfile = require('../models/parentProfile');
const User = require('../models/user');
require('dotenv').config({ path: '../.env' });

const TARGET_PARENTS_COUNT = 300;

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

// --- Sample Seed Data Arrays ---
const firstNames = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa', 'Deborah'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White'];
const jobTitles = ['Teacher', 'Doctor', 'Real Estate Agent', 'Architect', 'Small Business Owner', 'Accountant', 'Lawyer', 'Manager', 'Retired', 'HR Specialist', 'Engineer', 'Consultant'];

function getRandomItem(array) {
    if (!array || !array.length) return null;
    return array[Math.floor(Math.random() * array.length)];
}

// Generates valid min and max age preferences according to schema rules
function generateAgePreferences() {
    // Schema limits: min 18, max 94
    const sonAgeMin = Math.floor(Math.random() * (94 - 18 + 1)) + 18;
    
    // Schema limits: min 23, max 100. Must also be >= sonAgeMin
    const maxBound = Math.max(sonAgeMin, 23);
    const sonAgeMax = Math.floor(Math.random() * (100 - maxBound + 1)) + maxBound;

    return { sonAgeMin, sonAgeMax };
}

// --- Seed Script ---
const seedDB = async () => {
    try {
        console.log('Cleaning existing parent profiles and parent user accounts...');
        await ParentProfile.deleteMany({});
        await User.deleteMany({ role: 'parent' });

        console.log(`Starting to seed ${TARGET_PARENTS_COUNT} parent profiles...`);

        for (let i = 1; i <= TARGET_PARENTS_COUNT; i++) {
            const firstName = getRandomItem(firstNames);
            const lastName = getRandomItem(lastNames);
            const fullName = `${firstName} ${lastName}`;
            const email = `parent${i}_${Date.now()}@example.com`;
            const password = 'Password123!';

            // 1. Create and Register User
            const user = new User({
                email: email,
                role: 'parent',
                isVerified: true // Required by custom passportLocalMongoose findByUsername query
            });

            const registeredUser = await User.register(user, password);

            // 2. Generate age range preferences
            const { sonAgeMin, sonAgeMax } = generateAgePreferences();

            // 3. Create ParentProfile
            const parentProfile = new ParentProfile({
                owner: registeredUser._id,
                fullName: fullName,
                job: getRandomItem(jobTitles),
                address: getRandomCity(),
                sonAgeMin: sonAgeMin,
                sonAgeMax: sonAgeMax
            });

            await parentProfile.save();

            if (i % 50 === 0 || i === TARGET_PARENTS_COUNT) {
                console.log(`Seeded ${i}/${TARGET_PARENTS_COUNT} parents...`);
            }
        }

        console.log('Successfully seeded all 300 parent profiles!');
    } catch (err) {
        console.error("Error during parent database seeding:", err);
    }
};

seedDB().then(() => {
    mongoose.connection.close();
});