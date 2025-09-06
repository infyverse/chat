import React from 'react'
import { Popper, ClickAwayListener } from '@mui/material'
import './styles/ChatHistoryPopup.css'
import groupChatsByDate from '../../utils/groupChatsByDate'
import { Chat } from '../../database/chats'

interface ChatHistoryPopupProps {
  chats: Chat[]
  onClose: () => void
  onSelectChat: (id: string) => void
  anchorEl: HTMLElement | null
  open: boolean
}

const ChatHistoryPopup: React.FC<ChatHistoryPopupProps> = ({
  chats,
  onClose,
  onSelectChat,
  anchorEl,
  open,
}) => {
  const groupedChats = groupChatsByDate(chats)

  return (
    <Popper open={open} anchorEl={anchorEl} placement="bottom-start" style={{ zIndex: 1300 }}>
      <ClickAwayListener onClickAway={onClose}>
        <div className="chat-history-popup">
          <div className="chat-history-popup-header">
            <h3>Chat History</h3>
            <button onClick={onClose}>&times;</button>
          </div>
          <div className="chat-history-popup-body">
            {Object.entries(groupedChats).map(([group, chatList]: [string, Chat[]]) =>
              chatList.length > 0 ? (
                <div key={group}>
                  <div className="chat-history-group-header">{group}</div>
                  <ul>
                    {chatList.map((chat: Chat) => (
                      <li key={chat.id} onClick={() => onSelectChat(chat.id)}>
                        <span className="chat-title">{chat.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        </div>
      </ClickAwayListener>
    </Popper>
  )
}

export default ChatHistoryPopup
