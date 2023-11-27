import { User } from "../server.js"

export const deleteUser = async (req, res) => {
	try {
		const user = await User.findById(req.body.id)
		compare(req.body.password, user.password, async (err, result) => {
			if (result) {
				await User.findByIdAndRemove(req.body.id)
				res.json({
					message: "success",
				})
			} else res.json({ message: "incorrect password" })
		})
	} catch (error) {
		console.log(error)
	}
}

export const deleteTrades = async (req, res) => {
	try {
		const id = JSON.parse(req.params.id)
		const user = await User.findById(id)
		user.trades = []
		await user.save()
		res.json({ trades: [] })
	} catch (error) {
		console.log(error)
	}
}

export const deleteLayout = async (req, res) => {
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
}
