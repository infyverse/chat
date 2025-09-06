import React, { useState } from 'react'
import SettingsPanel from './SettingsPanel'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import SettingsIcon from '@mui/icons-material/Settings'
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined'
import { Message } from '../../types'

interface NavigatorProps {
  onOpenChatHistory: (event: React.MouseEvent) => void
  onNewChat: () => void
}

const Navigator: React.FC<NavigatorProps> = ({ onOpenChatHistory, onNewChat }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleToggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen)
  }

  return (
    <div className="navigator">
      <button onClick={onOpenChatHistory} className="chat-history-button">
        <HistoryOutlinedIcon />
      </button>
      <button onClick={onNewChat} className="new-chat-button">
        <LibraryAddOutlinedIcon />
      </button>
      <button onClick={handleToggleSettings} className="settings-button">
        <SettingsIcon />
      </button>
      <SettingsPanel open={isSettingsOpen} onClose={handleToggleSettings} />
    </div>
  )
}

export default Navigator
