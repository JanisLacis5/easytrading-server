import axios from "axios"
import { User } from "../server.js"
import _ from "lodash"

export const ibkrFile = async (req, res) => {
	const { file, userId } = req.body
	try {
		const { data } = await axios.post("http://127.0.0.1:8000/ibkr-file/", {
			file: file,
		})

		const user = await User.findById(userId)
		data.data.map((trade) => {
			const { date, time, symbol, pl, action } = trade
			user.trades = [
				...user.trades,
				{
					stock: symbol,
					pl: pl,
					date: date,
					time: time,
					action: action,
				},
			]
		})
		const newUserTrades = user.trades
		await user.save()
		res.status(200).json({ trades: newUserTrades })
	} catch (error) {
		console.log(error)
	}
}

export const trwFile = async (req, res) => {
	const { file, userId } = req.body
	try {
		const { data } = await axios.post("http://127.0.0.1:8000/trw-file/", {
			file: file,
		})
		const user = await User.findById(userId)
		data.data.map((trade) => {
			const { date, time, symbol, pl, action } = trade
			let isDuplicate = false
			user.trades.map((tr) => {
				if (_.isEqual(tr, trade)) {
					console.log("equals!!")
					isDuplicate = true
				}
			})
			if (!isDuplicate) {
				user.trades = [
					...user.trades,
					{
						date: date,
						time: time,
						symbol: symbol,
						pl: pl,
						action: action,
					},
				]
			}
		})
		const newUserTrades = user.trades
		await user.save()
		res.status(200).json({ trades: newUserTrades })
	} catch (error) {
		console.log(error)
	}
}
