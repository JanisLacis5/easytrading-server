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
const jwt = require("jsonwebtoken")

const saltRounds = 10
const secretKey = "hello"

const app = express()
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    next()
})
app.use(express.json({limit: "3mb"}))
app.use(express.urlencoded({extended: true, limit: "3mb"}))

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
    email: String,
    password: String,
    trades: Array,
    data: Object,
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
                    email: profile.emails[0].value,
                    data: {
                        firstName: profile.name.givenName,
                        lastName: profile.name.familyName,
                        username: profile.displayName,
                        image: profile.photos[0].value,
                        account: "0",
                        startingAccount: "0",
                    },
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
        function (req, accessToken, refreshToken, profile, cb) {
            console.log(profile)
            User.findOrCreate(
                {
                    userId: profile.id,
                    data: {
                        firstName: profile.name.givenName,
                        lastName: profile.name.familyName,
                        username: profile.displayName,
                        // image:
                        // //     profile.photos[0].value ||
                        //     "/img/faces/unknown-user-pic.jpg",
                        account: "0",
                        startingAccount: "0",
                    },
                },
                function (err, user) {
                    req = profile.id
                    return cb(err, user)
                }
            )
        }
    )
)

const authenticateJWT = (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1]

    if (!token) {
        return res.status(401).json({message: "Unauthorized"})
    }

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            return res.status(403).json({message: "Invalid token"})
        }

        req.user = user
        next()
    })
}

app.get("/api", (req, res) => {
    res.json({error: "error"})
})

app.delete("/api/deleteTrades/:id", authenticateJWT, async (req, res) => {
    const id = req.params.id
    const user = await User.findByIdAndUpdate(id, {trades: []})
    await user.save()
    res.json({message: "works"})
})

app.post("/api/login", (req, res) => {
    const email = req.body.email
    const id = req.body.id
    if (!email) {
        User.findOne({userId: id}).then((item) => {
            if (item) {
                const token = jwt.sign(
                    {id: item.id, role: item.role},
                    secretKey,
                    {
                        expiresIn: "1h",
                    }
                )
                res.json({
                    id: item.id,
                    trades: item.trades,
                    info: item.data,
                    token: token,
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
                        if (result) {
                            const token = jwt.sign(
                                {id: item.id, role: item.role},
                                secretKey,
                                {
                                    expiresIn: "1h",
                                }
                            )
                            res.json({
                                id: item.id,
                                trades: item.trades,
                                info: item.data,
                                token,
                            })
                        } else res.json({message: "incorrect password"})
                    }
                )
            } else {
                res.json({message: "user does not exist"})
            }
        })
    }
})

app.post("/api/checkuser", (req, res) => {
    User.findOne({email: req.body.email})
        .then((item) => {
            if (!item) {
                res.json({message: "success"})
            } else {
                res.json({message: "user already exists"})
            }
        })
        .catch((e) => console.log(e))
})

app.post("/api/signup", (req, res) => {
    bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
        if (!err) {
            const user = new User({
                email: req.body.email,
                data: req.body.userData,
                password: hash,
            })
            user.save()
                .then(() => {
                    User.findOne({email: req.body.email}).then((item) => {
                        const token = jwt.sign(
                            {id: item.id, role: item.role},
                            secretKey,
                            {
                                expiresIn: "1h",
                            }
                        )
                        res.json({
                            id: item.id,
                            trades: item.trades,
                            info: item.data,
                            token,
                            message: "success",
                        })
                    })
                })
                .catch((err) => console.log(err))
        } else {
            res.json({error: err})
        }
    })
})

app.get(
    "/auth/google",
    passport.authenticate("google", {scope: ["email", "profile"]})
)
app.get(
    "/oauth2/redirect/google",
    passport.authenticate("google", {
        failureRedirect: "http://localhost:3000/api",
    }),
    async function (req, res) {
        const id = req.user.userId
        try {
            res.redirect(`http://localhost:5173/loading?id=${id}`)
        } catch (error) {
            console.log(error)
        }
    }
)

app.get(
    "/auth/facebook",
    passport.authenticate("facebook", {scope: ["profile"]})
)
app.get(
    "/auth/facebook/callback",
    passport.authenticate("facebook", {
        failureRedirect: "http://localhost:5173",
    }),
    async function (req, res) {
        const id = req.user.userId
        try {
            res.redirect(`http://localhost:5173/loading?id=${id}`)
        } catch (error) {
            console.log(error)
        }
    }
)

app.post("/api/socialdata", async (req, res) => {
    const {data} = await axios.post("http://localhost:3000/api/login", {
        id: req.body.id,
    })
    res.json({
        id: data.id,
        trades: data.trades,
        info: data.info,
        token: data.token,
    })
})

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

app.post("/api/updateaccbalance", async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.body.id,
            {
                $set: {"data.account": req.body.setAcc},
            },
            {new: true}
        )
        res.json({message: "success", info: user.data})
    } catch (error) {
        console.log(error)
    }
})

app.listen(3000, () => {
    console.log("Server is running on port 3000")
})
