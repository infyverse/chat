import React, { useCallback } from 'react'
import { Modal, Box, Typography, Button, Paper } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ToolsPanel from './ToolsPanel'
import { Tool } from '../../tools/tool-registry'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: '800px',
  bgcolor: 'rgb(46, 62, 78)',
  color: '#f4f7f6',
  border: '1px solid rgb(0, 199, 226)',
  boxShadow: 24,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '90vh',
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ open, onClose }) => {
  const handleSelectTool = useCallback((tool: Tool) => {
    // Handle tool selection
    console.log('Selected tool:', tool)
  }, [])

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Paper sx={style}>
        <div className="navigator">
          <h3>Settings</h3>
          <button onClick={onClose} className="settings-button">
            <CloseIcon />
          </button>
        </div>
        <Box sx={{ overflowY: 'auto', flexGrow: 1, p: 2 }}>
          <ToolsPanel onSelectTool={handleSelectTool} />
        </Box>
      </Paper>
    </Modal>
  )
}

export default SettingsPanel
