const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const ExpressError = require('./utils/ExpressError');
const User = require('./models/user');
require('dotenv').config();

const userRoutes = require('./routes/users');
const adminsRoutes = require('./routes/admins');
const sonRoutes = require('./routes/sons');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local');

const MongoDBStore = require("connect-mongo").default;

const dbUrl = process.env.ENVIRONMENT_VERSION === 'dev' ? 'mongodb://localhost:27017/project' : `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@datingproject.ktsayaf.mongodb.net/?appName=DatingProject`;

mongoose.connect(dbUrl);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

const secret = process.env.DATABASE_SECRET || 'thisshouldbeabettersecret!';

const store = MongoDBStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret
    }
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e)
})

const sessionConfig = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    // res.locals.success = req.flash('success');
    // res.locals.error = req.flash('error');
    next();
})

app.use('/', userRoutes);
app.use('/admins', adminsRoutes);
app.use('/sons', sonRoutes);

app.get('/', (req, res) => {
    res.send('Hello!');
});

app.use((req, res) => {
  res.status(404).send('Page not found!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serving on port ${port}`);
})