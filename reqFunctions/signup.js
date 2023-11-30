import jsonwebtoken from "jsonwebtoken"
import { User, saltRounds, secretKey } from "../server.js"
import bcrypt from "bcrypt"

export const signup = (req, res) => {
	console.log("sent")
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
					chatsActivityOrder: [],
				})
				await user.save()

				const completeUser = await User.findOne({
					email: req.body.email,
				})

				const token = jsonwebtoken.sign(
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
					chatsActivityOrder: completeUser.chatsActivityOrder,
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
}

export const checkUser = async (req, res) => {
	User.findOne({ email: req.body.email })
		.then((item) => {
			if (!item) {
				res.json({ message: "success" })
			} else {
				res.json({ message: "user already exists" })
			}
		})
		.catch((e) => console.log(e))
}
