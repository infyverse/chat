import { Chat } from '../database/chats'

const groupChatsByDate = (chats: Chat[]): { [key: string]: Chat[] } => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const grouped: { [key: string]: Chat[] } = {}

  chats.forEach((chat) => {
    const chatDate = new Date(chat.updatedAt)
    let groupKey: string

    if (chatDate >= today) {
      groupKey = 'Today'
    } else if (chatDate >= yesterday) {
      groupKey = 'Yesterday'
    } else {
      groupKey = chatDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    if (!grouped[groupKey]) {
      grouped[groupKey] = []
    }
    grouped[groupKey].push(chat)
  })

  return grouped
}

export default groupChatsByDate
