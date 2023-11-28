import { User } from "../server.js"

export const newTrade = async (req, res) => {
	const { id, stock, pl, date, time, action } = req.body
	try {
		const user = await User.findById(id)
		user.trades = [
			...user.trades,
			{
				stock: stock,
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
}

export const getTrades = async (req, res) => {
	const { userId } = req.body

	try {
		const user = await User.findById(userId)
		res.status(200).json({
			trades: user.trades,
		})
	} catch (error) {
		console.log(error)
	}
}
