export const newLayout = async (req, res) => {
	const layout = req.body.layout
	const id = req.body.id
	try {
		await User.findByIdAndUpdate(req.body.id, {
			$push: {
				layouts: layout,
			},
		})
		const user = await User.findById(id)

		res.json({ layouts: user.layouts })
	} catch (error) {
		console.log(error)
	}
}

export const editLayout = async (req, res) => {
	const layoutIndex = req.body.layoutIndex
	const layout = req.body.layout
	const id = req.body.id

	try {
		const user = await User.findById(id)

		let userLayout = user.layouts
		userLayout[layoutIndex] = layout

		await user.save()
		res.json({ layouts: userLayout })
	} catch (error) {
		console.log(error)
	}
}
