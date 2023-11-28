import { User, saltRounds } from "../server.js"
import bcrypt from "bcrypt"

export const updateUserData = async (req, res) => {
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
}

export const changePassword = (req, res) => {
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
}

export const changePricingPlan = async (req, res) => {
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
}
