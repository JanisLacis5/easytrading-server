import axios from "axios"
import { User } from "../server.js"

export const googleLogin = (req, accessToken, refreshToken, profile, cb) => {
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

export const fbLogin = (req, accessToken, refreshToken, profile, cb) => {
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
			chatsActivityOrder: [],
		},
		function (err, user) {
			req = profile.id
			return cb(err, user)
		}
	)
}

export const socialData = async (req, res) => {
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
		chatsActivityOrder: data.chatsActivityOrder,
	})
}
