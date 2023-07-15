require("dotenv").config()
const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const findOrCreate = require("mongoose-findorcreate")
const session = require("express-session")

const saltRounds = 10

const app = express()
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    next()
})

app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
mongoose.connect("mongodb://0.0.0.0:27017/tradingDB")

app.use(
    session({
        secret: "es",
        resave: false,
        saveUninitialized: true,
        cookie: {secure: true},
    })
)
app.use(passport.session())
passport.serializeUser(function (user, done) {
    done(null, user)
})

passport.deserializeUser(function (user, done) {
    done(null, user)
})

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
})
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema)

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/callback",
        },
        function (accessToken, refreshToken, profile, cb) {
            User.findOrCreate({googleId: profile.id}, function (err, user) {
                return cb(err, user)
            })
        }
    )
)

app.get("/api", (req, res) => {
    res.json({message: "hello"})
})

app.post("/api/login", (req, res) => {
    const email = req.body.email
    User.findOne({email: email}).then((item) => {
        if (item) {
            bcrypt.compare(
                req.body.password,
                item.password,
                function (err, result) {
                    console.log(result)
                }
            )
        } else {
            res.json({message: "bad"})
        }
    })
})

app.post("/api/signup", (req, res) => {
    User.findOne({email: req.body.email})
        .then((item) => {
            if (!item) {
                bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
                    if (!err) {
                        const user = new User({
                            email: req.body.email,
                            password: hash,
                        })
                        user.save()
                            .then(() => {
                                res.json({message: "success"})
                            })
                            .catch((err) => {
                                res.json({message: err})
                            })
                    } else {
                        res.json({error: err})
                    }
                })
            } else {
                res.json({
                    error: "User already exists",
                })
            }
        })
        .catch((err) => {
            console.log(err)
        })
})

app.get("/api/login/google", (req, res) => {
    res.redirect("http://localhost:3000/auth/google")
})

app.get("/auth/google", passport.authenticate("google", {scope: ["profile"]}))

app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
        failureRedirect: "http://localhost:3000/api",
    }),
    function (req, res) {
        res.redirect("http://localhost:5173")
    }
)

app.listen(3000, () => {
    console.log("Server is running on port 3000")
})
