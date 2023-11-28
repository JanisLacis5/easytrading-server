import { Message } from "../server.js"

export const contactMessage = async (req, res) => {
	try {
		const message = new Message({
			userId: req.body.id,
			email: req.body.email,
			question: req.body.question,
			message: req.body.message,
		})
		await message.save()
		res.json({ message: "Message succesfully sent" })
	} catch (error) {
		console.log(error)
	}
}
