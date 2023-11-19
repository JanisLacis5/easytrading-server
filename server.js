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
const { default: axios } = require("axios")
const jwt = require("jsonwebtoken")
const e = require("express")
const WebSocket = require("ws").Server
const _ = require("lodash")

// HASHING
const saltRounds = 10
const secretKey = "hello"

// TEMPLATE
const app = express()
app.use(express.json({ limit: "3mb" }))
app.use(express.urlencoded({ extended: true, limit: "3mb" }))

// CORS
const corsOptions = {
	origin: "http://localhost:5173",
	credentials: true,
	optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

// BODYPARSER
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// DATABASE
const userConn = mongoose.createConnection("mongodb://0.0.0.0:27017/tradingDB")
const messageConn = mongoose.createConnection(
	"mongodb://0.0.0.0:27017/tradingMessageDB"
)
const chatroomConn = mongoose.createConnection(
	"mongodb://0.0.0.0:27017/chatroomDB"
)

// COOKIES / SESSIONS
app.use(
	session({
		secret: "es",
		resave: false,
		saveUninitialized: true,
		cookie: { secure: false },
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
	email: String,
	password: String,
	trades: Array,
	data: Object,
	layouts: Array,
	notes: [
		{
			pinned: Boolean,
			image: String,
			text: String,
		},
	],
	messages: Object,
	hiddenMessages: Array,
	friends: Array,
	sentFriendRequests: Array,
	recievedFriendRequests: Array,
	blockedUsers: Array,
	lastActiveChat: Object,
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

const chatroomSchema = mongoose.Schema({
	name: String,
	admins: {
		userId: String,
	},
})

const Chatroom = messageConn.model("Chatroom", chatroomSchema)

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
					trades: [],
					layouts: [],
					notes: [],
					messages: {},
					hiddenMessages: [],
					friends: [],
					sentFriendRequests: [],
					recievedFriendRequests: [],
					blockedUsers: [],
					lastActiveChat: {},
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
		return res.status(401).json({ message: "Unauthorized" })
	}

	jwt.verify(token, secretKey, (err, user) => {
		if (err) {
			return res.status(403).json({ message: "Invalid token" })
		}

		req.user = user
		next()
	})
}

//////////////////////////////////////////////////////////////////////////////////

// ROUTES

//////////////////////////////////////////////////////////////////////////////////

// LOGIN
app.post("/api/login", async (req, res) => {
	const email = req.body.email
	const id = req.body.id

	if (!email) {
		try {
			const user = await User.findById(id)
			if (user) {
				const token = jwt.sign(
					{ id: user.id, role: user.role },
					secretKey,
					{
						expiresIn: "1h",
					}
				)
				res.json({
					id: user.id,
					trades: user.trades,
					info: user.data,
					notes: user.notes,
					token: token,
					friends: user.friends,
					sentFriendRequests: user.sentFriendRequests,
					recievedFriendRequests: user.recievedFriendRequests,
					messages: user.messages,
					hiddenMessages: user.hiddenMessages,
					blockedUsers: user.blockedUsers,
					lastActiveChat: user.lastActiveChat,
				})
			} else {
				res.json({ message: "social user does not exist" })
			}
		} catch (error) {
			console.log(error)
		}
	} else {
		try {
			User.findOne({ email: email }).then((item) => {
				if (item) {
					bcrypt.compare(
						req.body.password,
						item.password,
						function (err, result) {
							if (result) {
								const token = jwt.sign(
									{ id: item.id, role: item.role },
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
									friends: item.friends,
									layouts: item.layouts,
									sentFriendRequests: item.sentFriendRequests,
									recievedFriendRequests:
										item.recievedFriendRequests,
									messages: item.messages,
									hiddenMessages: item.hiddenMessages,
									blockedUsers: item.blockedUsers,
									lastActiveChat: item.lastActiveChat,
								})
							} else res.json({ message: "incorrect password" })
						}
					)
				} else {
					res.json({ message: "user does not exist" })
				}
			})
		} catch (error) {
			console.log(error)
		}
	}
})

//////////////////////////////////////////////////////////////////////////////////
// SOCIAL LOGIN

app.get(
	"/auth/google",
	passport.authenticate("google", { scope: ["email", "profile"] })
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

app.get(
	"/auth/facebook",
	passport.authenticate("facebook", { scope: ["email"] })
)
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
	const { data } = await axios.post("http://localhost:3000/api/login", {
		id: req.body.id,
	})
	res.json({
		id: data.id,
		trades: data.trades,
		info: data.info,
		token: data.token,
		layouts: data.layouts,
		notes: data.notes,
		messages: data.messages,
		recievedFriendRequests: data.recievedFriendRequests,
		sentFriendRequests: data.sentFriendRequests,
		hiddenMessages: data.hiddenMessages,
		friends: data.friends,
		blockedUsers: data.blockedUsers,
		lastActiveChat: data.lastActiveChat,
	})
})

//////////////////////////////////////////////////////////////////////////////////
// SIGNUP

app.post("/api/signup", (req, res) => {
	try {
		bcrypt.hash(req.body.password, saltRounds, async (err, hash) => {
			if (!err) {
				const user = new User({
					email: req.body.email,
					data: req.body.userData,
					password: hash,
					trades: [],
					layouts: [],
					notes: [],
					messages: {},
					hiddenMessages: [],
					friends: [],
					sentFriendRequests: [],
					recievedFriendRequests: [],
					blockedUsers: [],
					lastActiveChat: {},
				})
				await user.save()

				const completeUser = await User.findOne({
					email: req.body.email,
				})

				const token = jwt.sign(
					{ id: completeUser.id, role: completeUser.role },
					secretKey,
					{
						expiresIn: "1h",
					}
				)

				res.json({
					id: completeUser.id,
					trades: completeUser.trades,
					info: completeUser.data,
					notes: completeUser.notes,
					layouts: completeUser.layouts,
					messages: completeUser.messages,
					friends: completeUser.friends,
					recievedFriendRequests: completeUser.recievedFriendRequests,
					sentFriendRequests: completeUser.sentFriendRequests,
					blockedUsers: completeUser.blockedUsers,
					lastActiveChat: completeUser.lastActiveChat,
					hiddenMessages: completeUser.hiddenMessages,
					token,
					message: "success",
				})
			} else {
				res.json({ error: err })
			}
		})
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/checkuser", async (req, res) => {
	User.findOne({ email: req.body.email })
		.then((item) => {
			if (!item) {
				res.json({ message: "success" })
			} else {
				res.json({ message: "user already exists" })
			}
		})
		.catch((e) => console.log(e))
})

//////////////////////////////////////////////////////////////////////////////////
// NEW

app.post("/api/newtrade", async (req, res) => {
	const { id, stock, accBefore, accAfter, pl, date, time, action } = req.body
	try {
		const user = await User.findById(id)
		user.trades = [
			...user.trades,
			{
				stock: stock,
				accBefore: accBefore,
				accAfter: accAfter,
				pl: pl,
				date: date,
				time: time,
				action: action,
			},
		]
		user.trades = [
			...user.trades.sort((a, b) => {
				return new Date(b.date).getTime() - new Date(a.date).getTime()
			}),
		]
		await user.save()
		const returnUser = await User.findById(id)
		res.status(200).json({ trades: returnUser.trades })
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/tradesfile", async (req, res) => {
	const file = req.body.data
	const id = req.body.id

	try {
		const addTrades = async (trades) => {
			return Promise.all(
				trades.map(async (trade) => {
					const {
						stock,
						accAfter,
						accBefore,
						pl,
						date,
						time,
						action,
					} = trade

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
		res.json({ trades: user.trades })
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/note", async (req, res) => {
	try {
		const update = await User.findByIdAndUpdate(req.body.id, {
			$push: {
				notes: {
					image: req.body.image,
					text: req.body.text,
					pinned: false,
				},
			},
		})
		await update.save()
		const user = await User.findById(req.body.id)
		res.json({ notes: user.notes })
	} catch (error) {
		console.log(error)
	}
})

app.patch("/api/noteupdate", async (req, res) => {
	const func = req.body.func
	const id = req.body.id
	const index = req.body.index

	try {
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
		res.json({ notes: updatedUser.notes })
	} catch (error) {
		console.log(error)
	}
})

//////////////////////////////////////////////////////////////////////////////////
// USER UPDATES

app.patch("/api/updateaccbalance", async (req, res) => {
	try {
		const user = await User.findByIdAndUpdate(
			req.body.id,
			{
				$set: { "data.account": req.body.setAcc },
			},
			{ new: true }
		)
		res.json({ message: "success", info: user.data })
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/updateuser", async (req, res) => {
	const { id, username, email, balance, image } = req.body
	try {
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
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/changepassword", (req, res) => {
	try {
		bcrypt.hash(req.body.password, saltRounds, async (err, hash) => {
			if (!err) {
				const user = await User.findByIdAndUpdate(req.body.id, {
					$set: { password: hash },
				})
				await user.save()

				res.json({
					message: "success",
				})
			} else {
				res.json({ error: err })
			}
		})
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/changeplan", async (req, res) => {
	const id = req.body.id
	const pricingPlan = req.body.plan

	try {
		const user = await User.findById(id)
		user.data.pricing = pricingPlan
		await user.save()
		res.json({
			info: user.data,
		})
	} catch (error) {
		console.log(error)
	}
})

app.patch("/api/deleteuser", async (req, res) => {
	try {
		const user = await User.findById(req.body.id)
		bcrypt.compare(
			req.body.password,
			user.password,
			async (err, result) => {
				if (result) {
					await User.findByIdAndRemove(req.body.id)
					res.json({
						message: "success",
					})
				} else res.json({ message: "incorrect password" })
			}
		)
	} catch (error) {
		console.log(error)
	}
})

app.delete("/api/deleteTrades/:id", authenticateJWT, async (req, res) => {
	try {
		const id = JSON.parse(req.params.id)
		const user = await User.findByIdAndUpdate(id, { trades: [] })
		await user.save()
		res.json({ message: "works" })
	} catch (error) {
		console.log(error)
	}
})

//////////////////////////////////////////////////////////////////////////////////
// MESSAGES (CONTACT)

app.post("/api/message", async (req, res) => {
	try {
		const message = new Message({
			userId: req.body.id,
			email: req.body.email,
			question: req.body.question,
			message: req.body.message,
		})
		await message.save()
		res.json({ message: "Message succesfully sent" })
	} catch (error) {
		console.log(error)
	}
})

///////////////////////////////////////////////////////////////////////////////////
// GETTING SCREENERS INFO / SENDING INFO

let client = null
const server = new WebSocket({
	port: 3001,
})

server.on("connection", (socket) => {
	client = socket
	socket.send("Client connected")
	socket.on("close", () => {
		client = null
	})
})

app.post("/api/hod-screener-data", async (req, res) => {
	const stockData = req.body
	client.send(JSON.stringify(stockData))

	res.json({ message: "success" })
})

//////////////////////////////////////////////////////////////////////////////////
// SCREENER LAYOUTS

app.post("/api/new-layout", async (req, res) => {
	const layout = req.body.layout
	const id = req.body.id
	try {
		await User.findByIdAndUpdate(req.body.id, {
			$push: {
				layouts: layout,
			},
		})
		const user = await User.findById(id)

		res.json({ layouts: user.layouts })
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/edit-layout", async (req, res) => {
	const layoutIndex = req.body.layoutIndex
	const layout = req.body.layout
	const id = req.body.id

	try {
		const user = await User.findById(id)

		let userLayout = user.layouts
		userLayout[layoutIndex] = layout

		await user.save()
		res.json({ layouts: userLayout })
	} catch (error) {
		console.log(error)
	}
})

app.put("/api/delete-layout", async (req, res) => {
	const id = req.body.id
	const layoutIndex = req.body.index
	try {
		const user = await User.findById(id)

		const updatedUserLayouts = user.layouts.filter(
			(_, index) => index !== layoutIndex
		)
		user.layouts = updatedUserLayouts
		await user.save()
		res.json({ layouts: user.layouts })
	} catch (error) {
		console.log(error)
	}
})

//////////////////////////////////////////////////////////////////////////////////
// CHATROOM SERVER

// NOTIFICATION SOCKET

const notiSockets = new Map()
const notiServer = new WebSocket({
	port: 5000,
})
notiServer.on("connection", (ws) => {
	ws.on("error", console.error)

	ws.on("message", async (data) => {
		const { id } = JSON.parse(data)
		notiSockets.set(id, ws)
	})
})

// MESSAGE SOCKET
const messageSockets = new Map()
const chatroomServer = new WebSocket({
	port: 3002,
})
chatroomServer.on("connection", (ws) => {
	ws.on("error", console.error)

	ws.on("message", async (data) => {
		if (JSON.parse(data).id) {
			const { id } = JSON.parse(data)
			messageSockets.set(id, ws)
		} else {
			const { date, time, message, senderEmail, recieverEmail } =
				JSON.parse(data)

			const fullMessage = {
				date,
				time,
				message,
			}

			try {
				const sender = await User.findOne({ email: senderEmail })
				const reciever = await User.findOne({ email: recieverEmail })

				// CHECK IF RECIEVER HASNT BLOCKED SENDER
				const isSenderBlocked = reciever.blockedUsers.find(
					(u) => u.email === senderEmail
				)

				if (!isSenderBlocked) {
					if (typeof sender.messages[recieverEmail] === "undefined") {
						reciever.messages[senderEmail] = []
					}

					reciever.messages = {
						...reciever.messages,
						[senderEmail]: [
							...reciever.messages[senderEmail],
							{ ...fullMessage, sender: false },
						],
					}

					await reciever.save()
				}

				if (typeof sender.messages[recieverEmail] === "undefined") {
					sender.messages[recieverEmail] = []
				}

				sender.messages = {
					...sender.messages,
					[recieverEmail]: [
						...sender.messages[recieverEmail],
						{ ...fullMessage, sender: true },
					],
				}

				await sender.save()

				ws.send(
					JSON.stringify({
						status: "success",
						updatedMessages: sender.messages,
					})
				)

				const recieverSocket = notiSockets.get(reciever.id)

				if (recieverSocket && !isSenderBlocked) {
					recieverSocket.send(
						JSON.stringify({
							status: "new message",
							updatedMessages: reciever.messages,
						})
					)
				}
			} catch (error) {
				console.log(error)
			}
		}
	})
})

// ACCEPT / DECLINE FRIEND SOCKET
const adSockets = new Map()
const friendServer = new WebSocket({
	port: 3003,
})
friendServer.on("connection", (ws) => {
	ws.on("error", console.error)

	ws.on("message", async (data) => {
		if (JSON.parse(data).id) {
			const { id } = JSON.parse(data)
			adSockets.set(id, ws)
		} else {
			const { senderEmail, recieverEmail, action } = JSON.parse(data)

			try {
				const reciever = await User.findOne({ email: recieverEmail })
				const sender = await User.findOne({ email: senderEmail })

				if (action === "accept") {
					reciever.friends = [
						...reciever.friends,
						{
							email: senderEmail,
							username: sender.data.username,
						},
					]

					ws.send(
						JSON.stringify({
							status: "success",
							message: "friend request acccepted",
							friends: reciever.friends,
						})
					)
				} else {
					ws.send(
						JSON.stringify({
							status: "success",
							message: "friend request declined",
						})
					)
				}
				reciever.recievedFriendRequests = [
					...reciever.recievedFriendRequests.filter(
						(req) => req !== senderEmail
					),
				]

				await reciever.save()

				if (action === "accept") {
					sender.friends = [
						...sender.friends,
						{
							email: recieverEmail,
							username: reciever.data.username,
						},
					]

					const senderWs = notiSockets.get(sender.id)
					if (senderWs) {
						senderWs.send(
							JSON.stringify({
								status: "new friend",
								friends: sender.friends,
								sentFriendReq: sender.sentFriendRequests.filter(
									(req) => req !== recieverEmail
								),
							})
						)
					}
				}
				sender.sentFriendRequests = [
					...sender.sentFriendRequests.filter(
						(req) => req !== recieverEmail
					),
				]
				await sender.save()
			} catch (e) {
				console.log(e)
			}
		}
	})
})

// SEND FRIEND REQUEST
const reqSockets = new Map()
const sendFriendReq = new WebSocket({
	port: 3004,
})
sendFriendReq.on("connection", (ws) => {
	ws.on("error", console.error)

	ws.on("message", async (data) => {
		if (typeof JSON.parse(data).id !== "undefined") {
			reqSockets.set(JSON.parse(data).id, ws)
		} else {
			const { senderEmail, recieverEmail } = JSON.parse(data)

			let isReciever = true
			let isSentAlready = null
			let hasRecievedAlready = null

			try {
				const reciever = await User.findOne({ email: recieverEmail })
				const sender = await User.findOne({ email: senderEmail })

				if (reciever === null) {
					isReciever = false
					ws.send(
						JSON.stringify({
							status: "error",
							message: "user does not exist",
						})
					)
				}

				const recieverId = reciever.id
				const recieverWs = notiSockets.get(recieverId)

				isSentAlready = reciever.recievedFriendRequests.find(
					(em) => em === senderEmail
				)

				hasRecievedAlready = reciever.sentFriendRequests.find(
					(em) => em === senderEmail
				)

				if (isReciever && !isSentAlready && !hasRecievedAlready) {
					sender.sentFriendRequests = [
						...sender.sentFriendRequests,
						recieverEmail,
					]
					const senderSentReq = sender.sentFriendRequests
					await sender.save()
					ws.send(
						JSON.stringify({
							status: "success",
							sentFriendReq: senderSentReq,
						})
					)

					reciever.recievedFriendRequests = [
						...reciever.recievedFriendRequests,
						senderEmail,
					]
					const recieverRecReq = reciever.recievedFriendRequests
					await reciever.save()
					if (recieverWs) {
						recieverWs.send(
							JSON.stringify({
								status: "new friend request",
								recievedFriendReq: recieverRecReq,
							})
						)
					}
				}

				if (isSentAlready) {
					ws.send(
						JSON.stringify({
							status: "error",
							message: `you have already sent friend request to user with email: ${recieverEmail}`,
						})
					)
				}
				if (hasRecievedAlready) {
					ws.send(
						JSON.stringify({
							status: "error",
							message: `you already have request from user with email: ${recieverEmail}. check 'recieved friend requests page'`,
						})
					)
				}
			} catch (e) {
				console.log(e)
			}
		}
	})
})

//////////////////////////////////////////////////////////////////////////////////
// CHATROOM ROUTES

app.put("/api/remove-friend", async (req, res) => {
	const friendEmail = req.body.friendEmail
	const userId = req.body.userId
	try {
		const user = await User.findById(userId)
		const removedFriend = await User.findOne({ email: friendEmail })

		user.friends = [
			...user.friends.filter((friend) => {
				friend.email !== friendEmail
			}),
		]
		removedFriend.friends = [
			...removedFriend.friends.filter((friend) => {
				friend.email !== user.data.email
			}),
		]

		const updatedFriends = user.friends
		const updatedMessages = user.messages

		await user.save()
		await removedFriend.save()

		res.status(200).json({
			friends: updatedFriends,
			messages: updatedMessages,
		})
	} catch (error) {
		console.log(error)
	}
})

app.patch("/api/logout", (req, res) => {
	const id = req.body.id
	notiSockets.delete(id)
	messageSockets.delete(id)
	adSockets.delete(id)
	reqSockets.delete(id)
	res.status(200).json({ status: "success" })
})

app.post("/api/new-message", async (req, res) => {
	const { friendEmail, userId } = req.body

	try {
		const user = await User.findById(userId)
		const friend = await User.findOne({ email: friendEmail })

		user.messages = {
			...user.messages,
			[friendEmail]: [],
		}
		friend.messages = {
			...friend.messages,
			[user.email]: [],
		}

		await user.save()
		await friend.save()

		res.status(200).json({ message: "success" })
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/hide-chats", async (req, res) => {
	const { userId, friendEmail } = req.body

	try {
		const user = await User.findById(userId)
		const friend = await User.findOne({ email: friendEmail })

		if (user.hiddenMessages) {
			user.hiddenMessages = [
				...user.hiddenMessages,
				{ email: friendEmail, username: friend.data.username },
			]
		} else {
			user.hiddenMessages = [
				{ email: friendEmail, username: friend.data.username },
			]
		}

		const hiddenMessages = user.hiddenMessages

		await user.save()

		res.status(200).json({
			message: "success",
			hiddenMessages: hiddenMessages,
		})
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/block-user", async (req, res) => {
	const { userId, friendEmail } = req.body

	try {
		const user = await User.findById(userId)
		const friend = await User.findOne({ email: friendEmail })

		if (user.blockedUsers) {
			user.blockedUsers = [
				...user.blockedUsers,
				{ email: friendEmail, username: friend.data.username },
			]
		} else {
			user.blockedUsers = [
				{ email: friendEmail, username: friend.data.username },
			]
		}

		user.friends = [
			...user.friends.filter((fr) => fr.email !== friend.email),
		]

		const userBlockedUsers = user.blockedUsers

		await user.save()
		await friend.save()

		res.status(200).json({
			messages: "success",
			blockedUsers: userBlockedUsers,
		})
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/unblock-user", async (req, res) => {
	const { userId, friendEmail } = req.body

	try {
		// find both users
		const user = await User.findById(userId)
		const friend = await User.findOne({ email: friendEmail })

		// check if friend still has user in friends
		const isUserFriend = friend.friends.find((f) => f.email === user.email)

		// update blockedUsers array
		user.blockedUsers = [
			...user.blockedUsers.filter((f) => f.email !== friendEmail),
		]
		const updatedBlockedUsers = user.blockedUsers

		if (isUserFriend) {
			// update friends array
			user.friends = [
				...user.friends,
				{ email: friend.email, username: friend.data.username },
			]

			// restore all chats
			const allChats = friend.messages[user.email]
			if (allChats) {
				user.messages = {
					...user.messages,
					[friendEmail]: [
						...allChats.map((m) => {
							return {
								...m,
								sender: !m.sender,
							}
						}),
					],
				}
			}

			// updated values
			const updatedFriends = user.friends
			const updatedMessages = user.messages

			await user.save()

			res.status(200).json({
				blockedUsers: updatedBlockedUsers,
				friends: updatedFriends,
				messages: updatedMessages,
			})
		} else {
			await user.save()

			res.status(200).json({
				blockedUsers: updatedBlockedUsers,
				message: "add again",
			})
		}
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/set-last-chat", async (req, res) => {
	const { username, email, userId } = req.body

	try {
		const user = await User.findById(userId)

		user.lastActiveChat = {
			username: username,
			email: email,
		}

		const userLastActiveChat = user.lastActiveChat

		await user.save()

		res.status(200).json({
			message: "success",
			lastActiveChat: userLastActiveChat,
		})
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/get-last-chat", async (req, res) => {
	const { userId } = req.body
	try {
		const user = await User.findById(userId)
		res.status(200).json({
			lastChat: user.lastActiveChat,
		})
	} catch (error) {
		console.log(error)
	}
})

app.post("/api/find-username", async (req, res) => {
	const { email } = req.body

	try {
		const user = await User.findOne({ email: email })
		res.status(200).json({
			user: {
				email: user.email,
				username: user.data.username,
			},
		})
	} catch (error) {
		console.log(error)
	}
})

app.patch("/api/clear-chat", async (req, res) => {
	const { email, userId } = req.body

	try {
		const user = await User.findById(userId)

		user.messages = {
			...user.messages,
			[email]: [],
		}
		const newUserMessages = user.messages

		await user.save()

		res.status(200).json({
			messages: newUserMessages,
		})
	} catch (error) {
		console.log(error)
	}
})

app.patch("/api/delete-chat", async (req, res) => {
	const { email, userId } = req.body

	try {
		const user = await User.findById(userId)
		const updatedChats = _.omit(user.messages, email)

		user.messages = {
			...updatedChats,
		}
		const newUserMessages = user.messages

		await user.save()

		res.status(200).json({
			messages: newUserMessages,
		})
	} catch (error) {
		console.log(error)
	}
})

//////////////////////////////////////////////////////////////////////////////////

// ROUTES END

//////////////////////////////////////////////////////////////////////////////////

app.listen(3000, () => {
	console.log("Server running on port 3000")
})
