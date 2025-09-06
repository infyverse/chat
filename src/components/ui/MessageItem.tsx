import React, { memo } from 'react'
import { IconCopy, IconEdit, IconReply } from './Icons'
import DoneIcon from '@mui/icons-material/Done'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import Markdown from 'react-markdown'
import CachedImage from './CachedImage'
import { ClickAwayListener } from '@mui/material'
import ImageGeneratorToolCall from './ImageGeneratorToolCall'
import { parseToolCalls } from '../../tools/tools'

/**
 * Represents a single message in the chat.
 */
interface Message {
  id: string | number
  sender: 'user' | 'assistant'
  text: string
  timestamp: number
  attachments?: string[]
}

/**
 * Information about the message currently being edited.
 */
interface EditingInfo {
  historyIndex: number
  messageIndex: number
  currentEditText: string
}

/**
 * Information about sibling branches for a message, allowing navigation between different versions.
 */
interface SiblingBranchInfo {
  totalSiblings: number
  currentIndexInSiblings: number
  siblings: any[] // Type of siblings is unknown from context
}

/**
 * Props for the MessageItem component.
 */
interface MessageItemProps {
  message: Message
  historyIndex: number
  messageIndex: number
  onStartEdit: (historyIndex: number, messageIndex: number, text: string) => void
  editingInfo?: EditingInfo | null
  onEditInputChange: (value: string) => void
  onSaveEdit: (historyIndex: number, messageIndex: number, text: string) => void
  onForkEdit: (historyIndex: number, messageIndex: number, text: string) => void
  onCancelEdit: () => void
  siblingBranchInfo?: SiblingBranchInfo | null
  onNavigateToSiblingBranch: (newIndex: number, siblings: any[]) => void
  onCopyMessage: (text: string) => void
  onReplyWithImage: (imageUrl: string) => void
}

interface CachedImageProps {
  src: string
  alt: string
  className: string
  messageId: string | number
  imgIdx: number
}

const MessageItem = memo(
  ({
    message,
    historyIndex,
    messageIndex,
    onStartEdit,
    editingInfo,
    onEditInputChange,
    onSaveEdit,
    onForkEdit,
    onCancelEdit,
    siblingBranchInfo,
    onNavigateToSiblingBranch,
    onCopyMessage,
    onReplyWithImage,
  }: MessageItemProps) => {
    const isUserMessage = message.sender === 'user'
    const isCurrentlyEditing =
      editingInfo &&
      editingInfo.historyIndex === historyIndex &&
      editingInfo.messageIndex === messageIndex

    const extractImageUrls = (text: string, sender: string): string[] => {
      let regex
      if (sender && sender.toLowerCase().includes('image')) {
        regex = /(https?:\/\/[^\s]+)/g
      } else {
        regex = /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp|avif)[^\s]*)/gi
      }
      return text.match(regex) || []
    }

    if (isCurrentlyEditing) {
      return (
        <ClickAwayListener onClickAway={onCancelEdit}>
          <div className={`message-item ${message.sender} message-edit-form`}>
            <div className="edit-container">
              <textarea
                value={editingInfo.currentEditText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  onEditInputChange(e.target.value)
                }
                rows={3}
                autoFocus
              />
              <div className="edit-buttons">
                <button
                  className="done-button"
                  onClick={() =>
                    onForkEdit(historyIndex, messageIndex, editingInfo.currentEditText)
                  }
                >
                  <DoneIcon />
                </button>
              </div>
            </div>
            <div className="message-meta">Editing message</div>
          </div>
        </ClickAwayListener>
      )
    }

    // Extract image URLs from attachments or text
    const imageUrls =
      message.attachments && message.attachments.length > 0
        ? message.attachments
        : extractImageUrls(message.text, message.sender)

    const toolCalls = parseToolCalls(message.text)
    const imageToolCall = toolCalls.find(
      (tc) => tc.name && tc.name.toLowerCase().includes('image generator')
    )

    // Create a version of the text with image URLs and tool calls removed for display
    let displayText = message.text
    if (imageUrls.length > 0 && displayText) {
      imageUrls.forEach((url) => {
        displayText = displayText.replace(url, '').trim()
      })
    }
    if (imageToolCall) {
      const jsonRegex = /```json\s*([\s\S]*?)\s*```/
      const rawJsonRegex = /{\s*"tool_calls":\s*\[[\s\S]*?\]\s*}/
      displayText = displayText.replace(jsonRegex, '').replace(rawJsonRegex, '').trim()
    }

    return (
      <div className={`message-item ${message.sender}`}>
        {displayText && <Markdown>{displayText}</Markdown>}
        {imageToolCall && (
          <ImageGeneratorToolCall toolCall={imageToolCall} onCopyPrompt={onCopyMessage} />
        )}
        {imageUrls.length > 0 && (
          <div className="message-images">
            {imageUrls.map((url, idx) => (
              <div key={`${message.id}-img-container-${idx}`} className="image-container">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <CachedImage
                    src={url}
                    alt={`Image ${idx + 1} from message`}
                    className="message-image-thumb"
                    messageId={message.id}
                    imgIdx={idx}
                  />
                </a>
                <button
                  onClick={() => onReplyWithImage(url)}
                  className="reply-with-image-button"
                  title="Reply with this image"
                >
                  <IconReply />
                </button>
              </div>
            ))}
          </div>
        )}
        {message.sender !== 'user' && (
          <div className="message-meta">{message.sender.toUpperCase()}</div>
        )}
        {isUserMessage && (
          <div className="message-actions">
            <button onClick={() => onCopyMessage(message.text)} title="Copy message">
              <IconCopy />
            </button>
            <button
              onClick={() => onStartEdit(historyIndex, messageIndex, message.text)}
              title="Edit and resubmit"
            >
              <IconEdit />
            </button>
            {siblingBranchInfo && siblingBranchInfo.totalSiblings > 1 && (
              <div className="branch-nav">
                <button
                  onClick={() =>
                    onNavigateToSiblingBranch(
                      siblingBranchInfo.currentIndexInSiblings - 1,
                      siblingBranchInfo.siblings
                    )
                  }
                  disabled={siblingBranchInfo.currentIndexInSiblings === 0}
                  title="Previous version of this message"
                >
                  <ArrowBackIosNewIcon />
                </button>
                <span>
                  {' '}
                  {siblingBranchInfo.currentIndexInSiblings + 1}/{siblingBranchInfo.totalSiblings}{' '}
                </span>
                <button
                  onClick={() =>
                    onNavigateToSiblingBranch(
                      siblingBranchInfo.currentIndexInSiblings + 1,
                      siblingBranchInfo.siblings
                    )
                  }
                  disabled={
                    siblingBranchInfo.currentIndexInSiblings === siblingBranchInfo.totalSiblings - 1
                  }
                  title="Next version of this message"
                >
                  <ArrowForwardIosIcon />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

export default MessageItem
