import {
	adSockets,
	messageSockets,
	notiSockets,
	reqSockets,
} from "../server.js"

export const logout = (req, res) => {
	const id = req.body.id
	notiSockets.delete(id)
	messageSockets.delete(id)
	adSockets.delete(id)
	reqSockets.delete(id)
	res.status(200).json({ status: "success" })
}
