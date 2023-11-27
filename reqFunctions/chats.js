import { removeFromChatActivityOrder } from "../functions.js"
import { User } from "../server.js"

export const updateActiveChatsOrder = async (req, res) => {
	const { username, email, userId } = req.body

	try {
		const user = await User.findById(userId)

		const lastActiveChat = {
			username: username,
			email: email,
		}

		// filter out lastActiveChat from chatsActivityOrder and set it as first
		const newOrder = removeFromChatActivityOrder(
			user.chatsActivityOrder,
			email
		)
		newOrder.push(lastActiveChat)
		user.chatsActivityOrder = [...newOrder]

		await user.save()

		res.status(200).json({
			message: "success",
			lastActiveChat: lastActiveChat,
		})
	} catch (error) {
		console.log(error)
	}
}

export const getLastActiveChat = async (req, res) => {
	const { userId } = req.body
	try {
		const user = await User.findById(userId)
		res.status(200).json({
			lastActiveChat: user.chatsActivityOrder[0],
		})
	} catch (error) {
		console.log(error)
	}
}

export const findUsername = async (req, res) => {
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
}

export const deleteChat = async (req, res) => {
	const { email, userId } = req.body

	try {
		const user = await User.findById(userId)
		const updatedChats = omit(user.messages, email)

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
}

export const clearChat = async (req, res) => {
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
}
