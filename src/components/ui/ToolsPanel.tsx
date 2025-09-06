import React, { useState, useMemo, useEffect } from 'react'
import {
  TextField,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Switch,
  IconButton,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CloseIcon from '@mui/icons-material/Close'
import { toolManager } from '../../tools/tools'
import { Tool } from '../../tools/tool-registry'

interface ToolsPanelProps {
  onSelectTool: (tool: Tool) => void
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({ onSelectTool }) => {
  const [urlToLoad, setUrlToLoad] = useState<string>('')
  const [toolsVersion, setToolsVersion] = useState<number>(0)
  const [expanded, setExpanded] = useState<string | false>(false)

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false)
  }

  const allTools = useMemo(() => toolManager.getAll(), [toolsVersion])

  useEffect(() => {
    const handleToolsUpdated = () => {
      setToolsVersion((v) => v + 1)
    }

    toolManager.events.addEventListener('tools-updated', handleToolsUpdated)

    return () => {
      toolManager.events.removeEventListener('tools-updated', handleToolsUpdated)
    }
  }, [])

  const groupedTools = useMemo(() => {
    const groups = new Map<string, Tool[]>()
    allTools.forEach((tool: Tool) => {
      const key = tool.sourceUrl || 'local'
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(tool)
    })
    return Array.from(groups.entries())
  }, [allTools])

  const handleLoadFromUrl = async () => {
    if (!urlToLoad) return
    try {
      await toolManager.loadFromUrl(urlToLoad)
      setUrlToLoad('')
      setToolsVersion((v) => v + 1)
    } catch (error) {
      console.error(`Failed to load tools from ${urlToLoad}:`, error)
      alert(`Error loading tools from URL. See console for details.`)
    }
  }

  const handleToggleTool = (tool: Tool) => {
    tool.toggle()
    setToolsVersion((v) => v + 1)
  }

  const handleDeleteUrl = (url: string) => {
    if (window.confirm(`Are you sure you want to delete all tools from ${url}?`)) {
      toolManager.deleteToolsFromUrl(url)
    }
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Tools
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          label="Load tools from JS URL"
          variant="outlined"
          size="small"
          fullWidth
          value={urlToLoad}
          onChange={(e) => setUrlToLoad(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'rgba(0, 199, 226, 0.5)',
              },
              '&:hover fieldset': {
                borderColor: '#00c7e2',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#00c7e2',
              },
            },
            '& .MuiInputLabel-root': {
              color: '#00c7e2',
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: '#00c7e2',
            },
            '& .MuiInputBase-input': {
              color: '#f4f7f6',
            },
          }}
        />
        <Button
          onClick={handleLoadFromUrl}
          variant="contained"
          sx={{ backgroundColor: '#00c7e2', '&:hover': { backgroundColor: '#0099b0' } }}
        >
          Load
        </Button>
      </Box>

      {groupedTools.length > 0 ? (
        groupedTools.map(([sourceUrl, tools]) => (
          <Accordion
            key={sourceUrl}
            expanded={expanded === sourceUrl}
            onChange={handleChange(sourceUrl)}
            sx={{
              backgroundColor: 'rgba(26, 42, 58, 0.5)',
              color: 'inherit',
              '&:before': {
                display: 'none',
              },
              border: '1px solid rgba(0, 199, 226, 0.5)',
              marginBottom: '1rem',
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}
              sx={{
                flexDirection: 'row-reverse',
                '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
                  transform: 'rotate(180deg)',
                },
                '& .MuiAccordionSummary-content': {
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginLeft: 1,
                },
              }}
            >
              <Typography>{sourceUrl}</Typography>
              {sourceUrl !== 'local' && (
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteUrl(sourceUrl)
                  }}
                  size="small"
                  sx={{
                    backgroundColor: 'red',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'darkred',
                    },
                    padding: '2px',
                  }}
                >
                  <CloseIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              )}
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
                {tools.map((tool: Tool, index: number) => (
                  <li
                    key={tool.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      cursor: 'pointer',
                    }}
                  >
                    <div onClick={() => onSelectTool(tool)} style={{ flexGrow: 1 }}>
                      <Typography
                        variant="subtitle1"
                        component="h3"
                        sx={{ fontWeight: 600, color: '#00c7e2' }}
                      >
                        {tool.name}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {tool.description}
                      </Typography>
                    </div>
                    <Switch
                      checked={tool.enabled}
                      onChange={() => handleToggleTool(tool)}
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#00c7e2',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 199, 226, 0.08)',
                          },
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#00c7e2',
                        },
                      }}
                    />
                  </li>
                ))}
              </ul>
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <Typography align="center" sx={{ p: 2 }}>
          No tools found.
        </Typography>
      )}
    </Box>
  )
}

export default ToolsPanel
