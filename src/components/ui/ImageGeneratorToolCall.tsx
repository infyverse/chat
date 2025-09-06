import React from 'react'
import { IconCopy } from './Icons'

interface ImageGeneratorToolCallProps {
  toolCall: {
    name: string
    parameters: {
      prompt: string
      aspectRatio?: string
    }
  }
  onCopyPrompt: (prompt: string) => void
}

const ImageGeneratorToolCall: React.FC<ImageGeneratorToolCallProps> = ({
  toolCall,
  onCopyPrompt,
}) => {
  const { name, parameters } = toolCall
  const { prompt, aspectRatio } = parameters

  return (
    <div className="image-generator-tool-call">
      <div className="tool-header">
        <div className="tool-name">{name}</div>
        {aspectRatio && <div className="aspect-ratio">{aspectRatio}</div>}
      </div>
      <div className="prompt-container">
        <div className="prompt-text">{prompt}</div>
        <button
          onClick={() => onCopyPrompt(prompt)}
          className="copy-prompt-button"
          title="Copy prompt"
        >
          <IconCopy />
        </button>
      </div>
    </div>
  )
}

export default ImageGeneratorToolCall
