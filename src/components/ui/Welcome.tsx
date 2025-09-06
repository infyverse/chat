import React from 'react'
import './styles/Welcome.css'

const Welcome: React.FC = () => {
  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <h1>Welcome!</h1>
        <p>Start a new conversation by typing in the message box below.</p>
      </div>
    </div>
  )
}

export default Welcome
