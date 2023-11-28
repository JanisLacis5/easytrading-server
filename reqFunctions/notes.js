import { User } from "../server.js"

export const newNote = async (req, res) => {
	try {
		const update = await User.findByIdAndUpdate(req.body.id, {
			$push: {
				notes: {
					image: req.body.image,
					text: req.body.text,
					pinned: false,
				},
			},
		})
		await update.save()
		const user = await User.findById(req.body.id)
		res.json({ notes: user.notes })
	} catch (error) {
		console.log(error)
	}
}

export const noteUpdate = async (req, res) => {
	const func = req.body.func
	const id = req.body.id
	const index = req.body.index

	try {
		const user = await User.findById(id)

		if (func === "pin") {
			user.notes[index].pinned = true
		}
		if (func === "unpin") {
			user.notes[index].pinned = false
		}
		if (func === "delete") {
			user.notes.pull(user.notes[index])
		}

		await user.save()

		const updatedUser = await User.findById(id)
		res.json({ notes: updatedUser.notes })
	} catch (error) {
		console.log(error)
	}
}
