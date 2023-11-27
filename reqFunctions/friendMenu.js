import { User } from "../server.js"

export const sendMessage = async (req, res) => {
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
}

export const hideChats = async (req, res) => {
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

		// remove hidden chat from activity order
		const newChatsActivityOrder = removeFromChatActivityOrder(
			user.chatsActivityOrder,
			friendEmail
		)
		user.chatsActivityOrder = [...newChatsActivityOrder]

		const hiddenMessages = user.hiddenMessages

		await user.save()

		res.status(200).json({
			message: "success",
			hiddenMessages: hiddenMessages,
		})
	} catch (error) {
		console.log(error)
	}
}

export const unhideChat = async (req, res) => {
	const { email, userId } = req.body

	try {
		const user = await User.findById(userId)

		const updatedHiddenMessages = user.hiddenMessages.filter(
			(m) => m.email !== email
		)
		user.hiddenMessages = [...updatedHiddenMessages]

		await user.save()

		res.status(200).json({
			hiddenMessages: updatedHiddenMessages,
		})
	} catch (error) {
		console.log(error)
	}
}

export const blockUser = async (req, res) => {
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
}

export const unblockUser = async (req, res) => {
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
}

export const removeFriend = async (req, res) => {
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
}
