export const removeFromChatActivityOrder = (order, email) => {
	const ret = order.filter((user) => user.email !== email)
	return ret
}
