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
const WebSocket = require("ws").Server

// HASHING
const saltRounds = 10
const secretKey = "hello"

// TEMPLATE
const app = express()
app.use(express.json({limit: "3mb"}))
app.use(express.urlencoded({extended: true, limit: "3mb"}))

// CORS
const corsOptions = {
    origin: "http://localhost:5173",
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

// BODYPARSER
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

// DATABASE
const userConn = mongoose.createConnection("mongodb://0.0.0.0:27017/tradingDB")
const messageConn = mongoose.createConnection(
    "mongodb://0.0.0.0:27017/tradingMessageDB"
)

// COOKIES / SESSIONS
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

// MONGOSSE
const userSchema = new mongoose.Schema({
    userId: String,
    email: String,
    password: String,
    trades: Array,
    data: Object,
    notes: [
        {
            pinned: Boolean,
            image: String,
            text: String,
        },
    ],
})
userSchema.plugin(findOrCreate)

const User = userConn.model("User", userSchema)

const messageSchema = new mongoose.Schema({
    userId: String,
    email: String,
    question: String,
    message: String,
})

const Message = messageConn.model("Message", messageSchema)

// PASSPORT SOCIAL LOGIN STRATEGIES
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
                        email: profile.emails[0].value,
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
            profileFields: ["id", "emails", "name", "displayName", "photos"],
        },
        function (req, accessToken, refreshToken, profile, cb) {
            User.findOrCreate(
                {
                    userId: profile.id,
                    email: profile.emails[0].value,
                    data: {
                        email: profile.emails[0].value,
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

//////////////////////////////////////////////////////////////////////////////////

// ROUTES

//////////////////////////////////////////////////////////////////////////////////

// LOGIN
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
                    notes: item.notes,
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
                                notes: item.notes,
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

// SOCIAL LOGIN
app.get(
    "/auth/google",
    passport.authenticate("google", {scope: ["email", "profile"]})
)
app.get(
    "/oauth2/redirect/google",
    passport.authenticate("google", {
        failureRedirect: "http://localhost:5173",
    }),
    function (req, res) {
        const id = req.user.userId
        res.redirect(`http://localhost:5173/loading?id=${id}`)
    }
)

app.get("/auth/facebook", passport.authenticate("facebook", {scope: ["email"]}))
app.get(
    "/auth/facebook/callback",
    passport.authenticate("facebook", {
        failureRedirect: "http://localhost:5173",
    }),
    function (req, res) {
        const id = req.user.userId
        res.redirect(`http://localhost:5173/loading?id=${id}`)
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
        notes: data.notes,
    })
})

// SIGNUP

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

app.post("/api/checkuser", async (req, res) => {
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

// NEW

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

app.post("/api/tradesfile", async (req, res) => {
    const file = req.body.data
    const id = req.body.id

    console.log(file)

    const addTrades = async (trades) => {
        return Promise.all(
            trades.map(async (trade) => {
                const {stock, accAfter, accBefore, pl, date, time, action} =
                    trade

                await User.findByIdAndUpdate(id, {
                    $push: {
                        trades: {
                            stock,
                            accBefore,
                            accAfter,
                            pl,
                            date,
                            time,
                            action,
                        },
                    },
                })
            })
        )
    }

    await addTrades(file)
    const user = await User.findById(id)
    res.json({trades: user.trades})
})

app.post("/api/note", async (req, res) => {
    const update = await User.findByIdAndUpdate(req.body.id, {
        $push: {
            notes: {image: req.body.image, text: req.body.text, pinned: false},
        },
    })
    await update.save()
    const user = await User.findById(req.body.id)
    res.json({notes: user.notes})
})

app.patch("/api/noteupdate", async (req, res) => {
    const func = req.body.func
    const id = req.body.id
    const index = req.body.index

    const user = await User.findById(id)

    if (func === "pin") {
        user.notes[index].pinned = true
    }
    if (func === "unpin") {
        user.notes[index].pinned = false
    }
    if (func === "delete") {
        user.notes.pull(user.notes[index])
    }

    await user.save()

    const updatedUser = await User.findById(id)
    res.json({notes: updatedUser.notes})
})

// USER UPDATES

app.patch("/api/updateaccbalance", async (req, res) => {
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

app.post("/api/updateuser", async (req, res) => {
    const {id, username, email, balance, image} = req.body

    const user = await User.findById(id)

    const newUsername = username ? username : user.data.username
    const newEmail = email ? email : user.email
    const newBalance = balance ? balance : user.data.account
    const newImage = image ? image : user.data.iamge

    const updatedUser = await User.findByIdAndUpdate(id, {
        $set: {
            "data.username": newUsername,
            email: newEmail,
            "data.account": newBalance,
            "data.email": newEmail,
            "data.image": newImage,
        },
    })

    await updatedUser.save()

    const response = await User.findById(id)

    res.json({
        message: "success",
        info: response.data,
    })
})

app.post("/api/changepassword", (req, res) => {
    bcrypt.hash(req.body.password, saltRounds, async (err, hash) => {
        if (!err) {
            const user = await User.findByIdAndUpdate(req.body.id, {
                $set: {password: hash},
            })
            await user.save()

            res.json({
                message: "success",
            })
        } else {
            res.json({error: err})
        }
    })
})

app.post("/api/changeplan", async (req, res) => {
    await User.findByIdAndUpdate(req.body.id, {
        $set: {"data.pricing": req.body.plan},
    })
    const user = await User.findById(req.body.id)
    res.json({
        info: user.data,
    })
})

app.patch("/api/deleteuser", async (req, res) => {
    const user = await User.findById(req.body.id)
    bcrypt.compare(req.body.password, user.password, async (err, result) => {
        if (result) {
            await User.findByIdAndRemove(req.body.id)
            res.json({
                message: "success",
            })
        } else res.json({message: "incorrect password"})
    })
})

app.delete("/api/deleteTrades/:id", authenticateJWT, async (req, res) => {
    const id = req.params.id
    const user = await User.findByIdAndUpdate(id, {trades: []})
    await user.save()
    res.json({message: "works"})
})

// MESSAGES (CONTACT)

app.post("/api/message", async (req, res) => {
    const message = new Message({
        userId: req.body.id,
        email: req.body.email,
        question: req.body.question,
        message: req.body.message,
    })
    await message.save()
    res.json({message: "Message succesfully sent"})
})

// GETTING SCREENERS INFO / SENDING INFO

const server = new WebSocket({
    server: app.listen(3000, () => {
        console.log("Server is running on port 3000")
    }),
})
let ws = null
server.on("connection", (socket) => {
    ws = socket
    console.log("client connected")
    ws.send("Client connected")
})

app.post("/api/hod-screener-data", async (req, res) => {
    const stockData = req.body
    console.log(stockData)
    if (ws) ws.send(JSON.stringify(stockData))

    res.json({message: "success"})
})

//////////////////////////////////////////////////////////////////////////////////

// ROUTES END

//////////////////////////////////////////////////////////////////////////////////
