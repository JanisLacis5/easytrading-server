require("dotenv").config()
const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy
const FacebookStrategy = require("passport-facebook").Strategy
const findOrCreate = require("mongoose-findorcreate")
const session = require("express-session")
const {default: axios} = require("axios")

const saltRounds = 10

const app = express()
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    next()
})

app.use(
    cors({
        origin: ["http://localhost:5173"],
        methods: "GET,POST,PUT,DELETE,OPTIONS",
    })
)
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
mongoose.connect("mongodb://0.0.0.0:27017/tradingDB")

app.use(
    session({
        secret: "es",
        resave: false,
        saveUninitialized: true,
        cookie: {secure: false},
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
    userId: String,
    twitterId: String,
    username: String,
    email: String,
    password: String,
    profile: Object,
    trades: Array,
})
userSchema.plugin(findOrCreate)

const User = new mongoose.model("User", userSchema)

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/oauth2/redirect/google",
        },
        function (req, accessToken, refreshToken, profile, cb) {
            User.findOrCreate(
                {
                    userId: profile.id,
                    username: profile.displayName,
                    email: profile.emails[0].value,
                },
                function (err, user) {
                    req = profile.id
                    return cb(err, user)
                }
            )
        }
    )
)

passport.use(
    new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: "http://localhost:3000/auth/facebook/callback",
        },
        function (accessToken, refreshToken, profile, cb) {
            User.findOrCreate(
                {
                    userId: profile.id,
                    username: profile.username,
                },
                function (err, user) {
                    return cb(err, user)
                }
            )
        }
    )
)

app.get("/api", (req, res) => {
    res.json({error: "error"})
})

app.post("/api/login", (req, res) => {
    const email = req.body.email
    const id = req.body.id
    if (!email) {
        User.findOne({userId: id}).then((item) => {
            if (item) {
                res.json({
                    id: item.id,
                    trades: item.trades,
                })
            } else {
                res.json({message: "social user does not exist"})
            }
        })
    } else {
        User.findOne({email: email}).then((item) => {
            if (item) {
                bcrypt.compare(
                    req.body.password,
                    item.password,
                    function (err, result) {
                        if (result)
                            res.json({
                                id: item.id,
                                trades: item.trades,
                            })
                        else res.json({message: "incorrect password"})
                    }
                )
            } else {
                res.json({message: "user does not exist"})
            }
        })
    }
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
                        User.findOne({email: req.body.email})
                            .then((item) => {
                                res.json({
                                    id: item.id,
                                    trades: item.trades,
                                    message: "success",
                                })
                            })
                            .catch((err) => console.log(err))
                    } else {
                        res.json({error: err})
                    }
                })
            } else {
                res.json({
                    message: "User already exists",
                })
            }
        })
        .catch((err) => {
            console.log(err)
        })
})

app.get("/auth/google", passport.authenticate("google", {scope: ["email"]}))
app.get(
    "/oauth2/redirect/google",
    passport.authenticate("google", {
        failureRedirect: "http://localhost:3000/api",
    }),
    async function (req, res) {
        const id = req.user.userId
        try {
            const {data} = await axios.post("http://localhost:3000/api/login", {
                id: id,
            })
            res.redirect(
                `http://localhost:5173/loading?id=${data.id}&trades=${data.trades}`
            )
        } catch (error) {
            console.log(error)
        }
    }
)

app.get("/auth/facebook", passport.authenticate("facebook"))
app.get(
    "/auth/facebook/callback",
    passport.authenticate("facebook", {
        failureRedirect: "http://localhost:5173",
    }),
    function (req, res) {
        res.redirect("http://localhost:5173")
    }
)

app.post("/api/newtrade", async (req, res) => {
    const {id, stock, accBefore, accAfter, pl, date, time, action} = req.body
    await User.findByIdAndUpdate(id, {
        $push: {
            trades: {
                stock: stock,
                accBefore: accBefore,
                accAfter: accAfter,
                pl: pl,
                date: date,
                time: time,
                action: action,
            },
        },
    })
    const user = await User.findById(id)
    res.status(200).json({id: user.id, trades: user.trades})
})

// app.get("/sociallogin", (req, res) => {
//     const id = req.query.id
//     User.findOne({userId: id}).then((item) => {
//         if (item) {
//             res.json({
//                 id: item.id,
//                 trades: item.trades,
//             })
//         } else {
//             res.json({message: "user does not exist"})
//         }
//     })
// })

app.listen(3000, () => {
    console.log("Server is running on port 3000")
})
