import dotenv from "dotenv"
dotenv.config()
import express, { json, urlencoded } from "express"
import cors from "cors"
import bodyparser from "body-parser"
import { createConnection, Schema } from "mongoose"
import { hash as _hash } from "bcrypt"
import passport from "passport"
import { Strategy as GoogleStrategy } from "passport-google-oauth20"
import { Strategy as FacebookStrategy } from "passport-facebook"
import findOrCreate from "mongoose-findorcreate"
import session from "express-session"
import { WebSocketServer } from "ws"
import _ from "lodash"
import { ibkrFile, trwFile } from "./reqFunctions/fileReaders.js"
import {
	deleteLayout,
	deleteTrades,
	deleteUser,
} from "./reqFunctions/delete.js"
import {
	blockUser,
	hideChats,
	removeFriend,
	sendMessage,
	unblockUser,
	unhideChat,
} from "./reqFunctions/friendMenu.js"
import {
	clearChat,
	findUsername,
	getLastActiveChat,
	updateActiveChatsOrder,
	deleteChat,
} from "./reqFunctions/chats.js"
import {
	fbLogin,
	googleLogin,
	socialData,
} from "./reqFunctions/socialLoginSignup.js"
import { idLogin, login } from "./reqFunctions/login.js"
import { checkUser, signup } from "./reqFunctions/signup.js"
import axios from "axios"
import { logout } from "./reqFunctions/logout.js"
import { editLayout, newLayout } from "./reqFunctions/screenerLayouts.js"
import { contactMessage } from "./reqFunctions/contact.js"
import { authenticateJWT } from "./functions.js"
import { newNote, noteUpdate } from "./reqFunctions/notes.js"
import { getTrades, newTrade } from "./reqFunctions/trades.js"
import {
	changePassword,
	changePricingPlan,
	updateUserData,
} from "./reqFunctions/userUpdates.js"

// HASHING
export const saltRounds = 10
export const secretKey = "hello"

// TEMPLATE
const app = express()
app.use(json({ limit: "3mb" }))
app.use(urlencoded({ extended: true, limit: "3mb" }))

// CORS
const corsOptions = {
	origin: "http://localhost:5173",
	credentials: true,
	optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

// BODYPARSER
app.use(bodyparser.urlencoded({ extended: false }))
app.use(bodyparser.json())

// DATABASE
const userConn = createConnection("mongodb://0.0.0.0:27017/tradingDB")
const messageConn = createConnection("mongodb://0.0.0.0:27017/tradingMessageDB")
const chatroomConn = createConnection("mongodb://0.0.0.0:27017/chatroomDB")

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

const userSchema = new Schema({
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
	chatsActivityOrder: Array,
})
userSchema.plugin(findOrCreate)

export const User = userConn.model("User", userSchema)

const messageSchema = new Schema({
	userId: String,
	email: String,
	question: String,
	message: String,
})

export const Message = messageConn.model("Message", messageSchema)

// PASSPORT SOCIAL LOGIN STRATEGIES
passport.use(
	new GoogleStrategy(
		{
			clientID: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
			callbackURL: "/oauth2/redirect/google",
		},
		googleLogin
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
		fbLogin
	)
)

// ROUTES

// LOGIN
app.post("/api/login", login)
app.post("/api/id-login", idLogin)

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

app.post("/api/socialdata", socialData)

// SIGNUP
app.post("/api/signup", signup)
app.post("/api/checkuser", checkUser)

// TRADES
app.post("/api/newtrade", newTrade)
app.post("/api/get-trades", getTrades)

// NOTES
app.post("/api/note", newNote)
app.patch("/api/noteupdate", noteUpdate)

// USER UPDATES
app.post("/api/updateuser", updateUserData)
app.post("/api/changepassword", changePassword)
app.post("/api/changeplan", changePricingPlan)
app.patch("/api/deleteuser", deleteUser)
app.delete("/api/deleteTrades/:id", authenticateJWT, deleteTrades)

// MESSAGES (CONTACT)

app.post("/api/message", contactMessage)

// GETTING SCREENERS INFO / SENDING INFO

let client = null
const server = new WebSocketServer({
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

// SCREENER LAYOUTS
app.post("/api/new-layout", newLayout)
app.post("/api/edit-layout", editLayout)
app.put("/api/delete-layout", deleteLayout)

// CHATROOM SERVER

// NOTIFICATION SOCKET

const notiSockets = new Map()
const notiServer = new WebSocketServer({
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
const chatroomServer = new WebSocketServer({
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
const friendServer = new WebSocketServer({
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
const sendFriendReq = new WebSocketServer({
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

// CHATROOM ROUTES

app.put("/api/remove-friend", removeFriend)
app.patch("/api/logout", logout)

// FRIEND MENU
app.post("/api/new-message", sendMessage)
app.post("/api/hide-chats", hideChats)
app.patch("/api/unhide-chat", unhideChat)
app.post("/api/block-user", blockUser)
app.post("/api/unblock-user", unblockUser)

// CHATS
app.post("/api/update-active-chats-order", updateActiveChatsOrder)
app.post("/api/get-last-active-chat", getLastActiveChat)
app.post("/api/find-username", findUsername)
app.patch("/api/clear-chat", clearChat)
app.patch("/api/delete-chat", deleteChat)

// FILE READERS
app.post("/api/ibkr-file", ibkrFile)
app.post("/api/trw-file", trwFile)

// ROUTES END

app.listen(3000, () => {
	console.log("Server running on port 3000")
})
