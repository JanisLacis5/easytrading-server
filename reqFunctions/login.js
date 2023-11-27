import { User } from "../server.js"
import jsonwebtoken from "jsonwebtoken"
import { compare } from "bcrypt"

export const login = async (req, res) => {
	const email = req.body.email
	const id = req.body.id
	if (!email) {
		try {
			const user = await User.findById(id)
			if (user) {
				const token = jsonwebtoken.sign(
					{ id: user.id, role: user.role },
					secretKey,
					{
						expiresIn: "1h",
					}
				)
				res.json({
					user: user,
					token: token,
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
					compare(
						req.body.password,
						item.password,
						function (err, result) {
							if (result) {
								const token = jsonwebtoken.sign(
									{ id: item.id, role: item.role },
									secretKey,
									{
										expiresIn: "1h",
									}
								)
								res.json({
									user: item,
									token: token,
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
}

export const idLogin = async (req, res) => {
	const { userId } = req.body

	try {
		const user = await User.findById(userId)
		res.status(200).json({
			user: user,
		})
	} catch (error) {
		console.log(error)
	}
}
