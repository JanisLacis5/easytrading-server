import jsonwebtoken from "jsonwebtoken"
import { secretKey } from "./server.js"

export const removeFromChatActivityOrder = (order, email) => {
	const ret = order.filter((user) => user.email !== email)
	return ret
}

export const authenticateJWT = (req, res, next) => {
	const token = req.header("Authorization")?.split(" ")[1]

	if (!token) {
		return res.status(401).json({ message: "Unauthorized" })
	}

	jsonwebtoken.verify(token, secretKey, (err, user) => {
		if (err) {
			return res.status(403).json({ message: "Invalid token" })
		}

		req.user = user
		next()
	})
}
