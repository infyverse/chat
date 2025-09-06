import React, { useState, useEffect, useRef, useCallback } from 'react'

import Welcome from './components/ui/Welcome'
import MessageItem from './components/ui/MessageItem'
import { toolProcessor } from './tools/tools'
import ChatHistoryPopup from './components/ui/ChatHistoryPopup'
import Navigator from './components/ui/Navigator'

import { dbPromise } from './database/chats'

import { Message, ChatSession, EditingInfo } from './types'

// --- HELPER FUNCTIONS & CONSTANTS ---
const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).substring(2)

const simulateAIResponse = async (
  userText: string,
  historyContext: Message[] = [],
  addResponseCallback: (response: Message) => void,
  attachments: string[] = []
) => {
  await toolProcessor(userText, historyContext, addResponseCallback, attachments)
}

const getInitialWelcomeMessage = (
  onChat?: (chat: { chatData: Message[][]; lastActiveBranchIndex: number }) => void
): Message[] => {
  if (onChat) onChat({ chatData: [[]], lastActiveBranchIndex: 0 })
  return []
}

// --- COMPONENTS ---

interface ChatMessagesProps {
  messages: Message[]
  historyIndex: number
  onStartEdit: (historyIdx: number, messageIdx: number, originalText: string) => void
  editingInfo: EditingInfo | null
  onEditInputChange: (newText: string) => void
  onSaveEdit: (hIndex: number, msgIndex: number, newText: string) => void
  onForkEdit: (hIndex: number, msgIndex: number, newText: string) => void
  onCancelEdit: () => void
  findSiblingBranchInfo: (
    currentDisplayedHistoryIndex: number,
    currentMessageIndexInDisplay: number
  ) => any
  onNavigateToSiblingBranch: (targetIndexWithinSiblingsList: number, siblingsList: any) => void
  onCopyMessage: (text: string) => void
  onReplyWithImage: (imageUrl: string) => void
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  historyIndex,
  onStartEdit,
  editingInfo,
  onEditInputChange,
  onSaveEdit,
  onForkEdit,
  onCancelEdit,
  findSiblingBranchInfo,
  onNavigateToSiblingBranch,
  onCopyMessage,
  onReplyWithImage,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'auto',
    })
    messagesEndRef.current?.focus({ preventScroll: true }) // prevent scroll on focus
  }, [messages])

  return (
    <div className="message-list">
      {messages.map((msg, index) => {
        let sbi = null
        if (msg.sender === 'user') {
          sbi = findSiblingBranchInfo(historyIndex, index)
        }
        return (
          <MessageItem
            key={`${historyIndex}-${msg.id}-${index}`}
            message={msg as Message & { sender: 'user' | 'assistant' }}
            historyIndex={historyIndex}
            messageIndex={index}
            onStartEdit={onStartEdit}
            editingInfo={editingInfo}
            onEditInputChange={onEditInputChange}
            onSaveEdit={onSaveEdit}
            onForkEdit={onForkEdit}
            onCancelEdit={onCancelEdit}
            siblingBranchInfo={sbi}
            onNavigateToSiblingBranch={onNavigateToSiblingBranch}
            onCopyMessage={onCopyMessage}
            onReplyWithImage={onReplyWithImage}
          />
        )
      })}
      <div ref={messagesEndRef} />
    </div>
  )
}

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoadingAI: boolean
  onAttachment: (urls: string[]) => void
}

const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSubmit,
  isLoadingAI,
  onAttachment,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const urls = pastedText.match(urlRegex)
    if (urls) {
      e.preventDefault()
      onAttachment(urls)
      const remainingText = pastedText.replace(urlRegex, '').trim()
      onChange(value + remainingText)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoadingAI && value.trim()) {
        onSubmit()
      }
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onAttachment([reader.result])
        }
      }
      reader.readAsDataURL(file)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])

  return (
    <form
      className="input-area"
      onSubmit={(e) => {
        e.preventDefault()
        if (!isLoadingAI && value.trim()) onSubmit()
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleImageUpload}
      />
      <button
        type="button"
        className="attachment-button"
        onClick={() => fileInputRef.current?.click()}
      >
        +
      </button>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder="Type your message..."
        rows={1}
        onKeyDown={handleKeyDown}
        disabled={isLoadingAI}
      />
      <button type="submit" disabled={isLoadingAI || !value.trim()}>
        {isLoadingAI ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}

interface AppProps {
  chatId?: string
  onChat?: (chat: any) => void
}

const App: React.FC<AppProps> = ({ chatId: initialChatId, onChat }) => {
  const [isExtensionActive, setIsExtensionActive] = useState<boolean>(false)
  const [chatId, setChatId] = useState<string | undefined>(initialChatId)
  const [histories, setHistories] = useState<Message[][]>([]) // Will be initialized after chatId is determined
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number>(0)
  const [currentInput, setCurrentInput] = useState<string>('')
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false)
  const [editingInfo, setEditingInfo] = useState<EditingInfo | null>(null)
  const [isChatLoaded, setIsChatLoaded] = useState<boolean>(false)
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState<boolean>(false)
  const [allChats, setAllChats] = useState<ChatSession[]>([])
  const [chatHistoryAnchorEl, setChatHistoryAnchorEl] = useState<HTMLElement | null>(null)
  const [attachments, setAttachments] = useState<string[]>([])

  useEffect(() => {
    const checkExtension = () => {
      const extensionElement = document.getElementById('infyverse-extension-data')
      if (extensionElement) {
        setIsExtensionActive(true)
      } else {
        setIsExtensionActive(false)
      }
    }

    checkExtension()

    const observer = new MutationObserver(checkExtension)
    observer.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('infyverse-extension-present', checkExtension)

    return () => {
      observer.disconnect()
      window.removeEventListener('infyverse-extension-present', checkExtension)
    }
  }, [])

  const handleNewChat = () => {
    const newChatId = generateId()
    const urlParams = new URLSearchParams()
    urlParams.set('id', newChatId)
    const newRelativePathQuery = window.location.pathname + '?' + urlParams.toString()
    window.history.pushState({ path: newRelativePathQuery }, '', newRelativePathQuery)
    setChatId(newChatId)
    setHistories([[]])
    setActiveHistoryIndex(0)
  }

  const currentMessages = histories[activeHistoryIndex] || []

  const handleReplyWithImage = useCallback((imageUrl: string) => {
    setAttachments((prev) => [...prev, imageUrl])
  }, [])

  const handleAddAttachment = useCallback((urls: string[]) => {
    setAttachments((prev) => [...prev, ...urls])
  }, [])

  const handleRemoveAttachment = useCallback((urlToRemove: string) => {
    setAttachments((prev) => prev.filter((url) => url !== urlToRemove))
  }, [])

  // Effect to get chatId from URL or generate a new one
  useEffect(() => {
    if (initialChatId) {
      setChatId(initialChatId)
      return
    }
    const urlParams = new URLSearchParams(window.location.search)
    let idFromUrl = urlParams.get('id')

    if (!idFromUrl) {
      idFromUrl = generateId()
      urlParams.set('id', idFromUrl)
      const newRelativePathQuery = window.location.pathname + '?' + urlParams.toString()
      window.history.replaceState({ path: newRelativePathQuery }, '', newRelativePathQuery)
    }
    setChatId(idFromUrl)
  }, [initialChatId]) // Run once on mount

  // Effect to load chat data from IDB when chatId is available
  useEffect(() => {
    if (!chatId) return

    const loadChat = async () => {
      setIsLoadingAI(true) // Use a general loading indicator
      try {
        const db = await dbPromise
        const session = await db.get('chats', chatId)
        if (session && session.chatData && session.chatData.length > 0) {
          const savedActiveIndex =
            session.lastActiveBranchIndex !== undefined ? session.lastActiveBranchIndex : 0
          setHistories(session.chatData)
          setActiveHistoryIndex((prevIdx) =>
            // Use saved index if valid, otherwise default or ensure it's within bounds
            Math.max(0, Math.min(savedActiveIndex, session.chatData.length - 1))
          )
        } else {
          if (window.self !== window.top) setHistories([[]])
          else setHistories([getInitialWelcomeMessage(onChat)])
          setActiveHistoryIndex(0)
        }
      } catch (error) {
        console.error('Failed to load chat from IDB:', error)
        if (window.self !== window.top) setHistories([[]])
        else setHistories([getInitialWelcomeMessage(onChat)])
        setActiveHistoryIndex(0)
      } finally {
        setIsChatLoaded(true)
        setIsLoadingAI(false)
      }
    }
    loadChat()
  }, [chatId, onChat])

  // Effect to listen for style messages from parent
  useEffect(() => {
    const handleStyleMessage = (event: MessageEvent) => {
      // Add origin check for security if the gallery is on a different domain
      // if (event.origin !== 'expected-gallery-origin') return;

      if (
        event.data &&
        event.data.type === 'applyStyle' &&
        typeof event.data.payload === 'string'
      ) {
        let styleElement = document.getElementById('dynamic-gallery-styles')
        if (!styleElement) {
          styleElement = document.createElement('style')
          styleElement.id = 'dynamic-gallery-styles'
          document.head.appendChild(styleElement)
        }
        styleElement.textContent = event.data.payload
      }
    }
    window.addEventListener('message', handleStyleMessage)
    return () => window.removeEventListener('message', handleStyleMessage)
  }, [])

  // Effect to save chat data to IDB when histories change
  useEffect(() => {
    if (!chatId || !isChatLoaded || histories.flat().length === 0) {
      return
    }

    const saveChat = async () => {
      try {
        const db = await dbPromise
        // const title = histories.flat().find((msg) => msg.sender === 'user')?.text || 'New Chat'
        //create title from last message of user based active branch
        let title = 'New Chat'
        const currentBranch = histories[activeHistoryIndex]
        if (currentBranch && currentBranch.length > 0) {
          // Find the last user message in the active branch
          for (let i = currentBranch.length - 1; i >= 0; i--) {
            if (currentBranch[i].sender === 'user') {
              title = currentBranch[i].text
              break
            }
          }
        }

        //get updatedAt from last message
        let updatedAt = new Date()
        if (currentBranch && currentBranch.length > 0) {
          updatedAt = new Date(currentBranch[currentBranch.length - 1].timestamp)
        }

        let updatedChat: ChatSession = {
          id: chatId,
          chatData: histories,
          lastActiveBranchIndex: activeHistoryIndex,
          updatedAt: updatedAt,
          title,
        }

        await db.put('chats', updatedChat)
        if (onChat) onChat(updatedChat)
      } catch (error) {
        console.error('Failed to save chat to IDB:', error)
      }
    }
    saveChat()
  }, [histories, chatId, isChatLoaded, activeHistoryIndex, onChat])

  const handleSendMessage = useCallback(async () => {
    if (currentInput.trim() === '' && attachments.length === 0) return

    const userMessage: Message = {
      id: generateId(),
      text: currentInput,
      sender: 'user',
      timestamp: Date.now(),
      attachments,
    }

    let textToSend = currentInput
    if (attachments.length > 0) {
      textToSend = `${textToSend} ${attachments.join(' ')}`.trim()
    }

    setCurrentInput('')
    setAttachments([])

    setHistories((prevHistories) => {
      const newHistories = prevHistories.map((h) => [...h])
      if (!newHistories[activeHistoryIndex]) {
        // Safety if activeHistoryIndex somehow invalid
        newHistories[activeHistoryIndex] = []
      }
      newHistories[activeHistoryIndex].push(userMessage)
      return newHistories
    })

    setIsLoadingAI(true)
    const contextForAI = histories[activeHistoryIndex] || [] // Get the most up-to-date context for the current branch

    let addResponseCallback = (response: Message) => {
      setHistories((prevHistories) => {
        const newHistories = prevHistories.map((h) => [...h])
        if (newHistories[activeHistoryIndex]) {
          const lastMessage =
            newHistories[activeHistoryIndex][newHistories[activeHistoryIndex].length - 1]
          if (lastMessage && lastMessage.id === response.id) {
            newHistories[activeHistoryIndex][newHistories[activeHistoryIndex].length - 1] = response
            return newHistories
          } else {
            newHistories[activeHistoryIndex].push(response)
          }
        }
        return newHistories
      })
    }
    await simulateAIResponse(textToSend, contextForAI, addResponseCallback, userMessage.attachments)

    setIsLoadingAI(false)
  }, [currentInput, activeHistoryIndex, histories, attachments])

  const handleStartEdit = useCallback(
    (historyIdx: number, messageIdx: number, originalText: string) => {
      if (historyIdx !== activeHistoryIndex) {
        setActiveHistoryIndex(historyIdx)
      }
      setEditingInfo({
        historyIndex: historyIdx,
        messageIndex: messageIdx,
        currentEditText: originalText,
      })
    },
    [activeHistoryIndex]
  )

  const handleEditInputChange = useCallback((newText: string) => {
    setEditingInfo((prev) => (prev ? { ...prev, currentEditText: newText } : null))
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingInfo(null)
  }, [])

  const handleSaveEdit = useCallback(
    async (hIndex: number, msgIndex: number, newText: string) => {
      if (!editingInfo || newText.trim() === '') return
      const originalMessage = histories[hIndex][msgIndex]
      setEditingInfo(null)
      setIsLoadingAI(true)

      const updatedUserMessage: Message = {
        ...originalMessage,
        id: generateId(),
        text: newText,
        timestamp: Date.now(),
      }

      setHistories((prevHistories) => {
        const newHistories = prevHistories.map((h) => [...h])
        newHistories[hIndex] = newHistories[hIndex].slice(0, msgIndex)
        newHistories[hIndex].push(updatedUserMessage)
        return newHistories
      })

      const contextForAI = (histories[hIndex] || []).slice(0, msgIndex)
      const attachmentsForAI = updatedUserMessage.attachments || []
      let textToSend = newText
      if (attachmentsForAI.length > 0) {
        textToSend = `${newText} ${attachmentsForAI.join(' ')}`.trim()
      }

      const addResponseCallback = (response: Message) => {
        setHistories((prevHistories) => {
          const newHistories = prevHistories.map((h) => [...h])
          const lastMessage = newHistories[hIndex][newHistories[hIndex].length - 1]
          if (lastMessage && lastMessage.id === response.id) {
            newHistories[hIndex][newHistories[hIndex].length - 1] = response
            return newHistories
          } else {
            newHistories[hIndex].push(response)
          }
          return newHistories
        })
      }
      await simulateAIResponse(textToSend, contextForAI, addResponseCallback, attachmentsForAI)
      setIsLoadingAI(false)
    },
    [editingInfo, histories]
  )

  const handleForkEdit = useCallback(
    async (hIndex: number, msgIndex: number, newText: string) => {
      if (!editingInfo || newText.trim() === '') return
      const originalMessage = histories[hIndex][msgIndex]
      setEditingInfo(null)
      setIsLoadingAI(true)

      const baseHistoryForFork = histories[hIndex].slice(0, msgIndex)
      const forkedUserMessage: Message = {
        ...originalMessage,
        id: generateId(),
        text: newText,
        timestamp: Date.now(),
      }
      const newForkedHistorySegment = [...baseHistoryForFork, forkedUserMessage]

      const newHistoryIndex = histories.length
      setHistories((prevHistories) => [...prevHistories, newForkedHistorySegment])
      setActiveHistoryIndex(newHistoryIndex)

      const attachmentsForAI = forkedUserMessage.attachments || []
      let textToSend = newText
      if (attachmentsForAI.length > 0) {
        textToSend = `${newText} ${attachmentsForAI.join(' ')}`.trim()
      }

      const addResponseCallback = (response: Message) => {
        setHistories((prevHistories) => {
          const newHistoriesPlusAI = prevHistories.map((h) => [...h])
          const lastMessage =
            newHistoriesPlusAI[newHistoryIndex][newHistoriesPlusAI[newHistoryIndex].length - 1]
          if (lastMessage && lastMessage.id === response.id) {
            newHistoriesPlusAI[newHistoryIndex][newHistoriesPlusAI[newHistoryIndex].length - 1] =
              response
            return newHistoriesPlusAI
          } else {
            newHistoriesPlusAI[newHistoryIndex].push(response)
          }
          return newHistoriesPlusAI
        })
      }
      await simulateAIResponse(
        textToSend,
        baseHistoryForFork,
        addResponseCallback,
        attachmentsForAI
      )

      setIsLoadingAI(false)
    },
    [editingInfo, histories]
  )

  const handleSelectHistory = useCallback((index: number) => {
    setActiveHistoryIndex(index)
    setEditingInfo(null)
  }, [])

  const handleCopyMessage = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      console.log('Message copied!') // Simple feedback
    } catch (err) {
      console.error('Failed to copy text: ', err)
      alert(
        'Could not copy text. Your browser might not support this feature or permissions are denied.'
      )
    }
  }, [])

  const findSiblingBranchInfo = useCallback(
    (currentDisplayedHistoryIndex: number, currentMessageIndexInDisplay: number) => {
      const currentHistory = histories[currentDisplayedHistoryIndex]
      if (
        !currentHistory ||
        currentMessageIndexInDisplay < 0 ||
        currentMessageIndexInDisplay >= currentHistory.length
      ) {
        return { siblings: [], currentIndexInSiblings: -1, totalSiblings: 0 }
      }
      if (currentHistory[currentMessageIndexInDisplay].sender !== 'user') {
        return { siblings: [], currentIndexInSiblings: -1, totalSiblings: 0 }
      }

      const stemToMatch = currentHistory.slice(0, currentMessageIndexInDisplay)

      const siblingBranches: { historyIndex: number; messageId: string | number }[] = []
      histories.forEach((historyCandidate, candidateHistoryIndex) => {
        if (
          historyCandidate.length > currentMessageIndexInDisplay &&
          historyCandidate[currentMessageIndexInDisplay].sender === 'user'
        ) {
          const candidateStem = historyCandidate.slice(0, currentMessageIndexInDisplay)

          if (
            stemToMatch.length === candidateStem.length &&
            stemToMatch.every((msg, i) => msg.id === candidateStem[i].id)
          ) {
            siblingBranches.push({
              historyIndex: candidateHistoryIndex,
              messageId: historyCandidate[currentMessageIndexInDisplay].id,
            })
          }
        }
      })

      // Filter to get unique branches based on the message ID at the fork point
      const uniqueSiblingBranches: { historyIndex: number; messageId: string | number }[] = []
      const seenMessageIds = new Set<string | number>()

      // Prioritize keeping the current history index if it's a duplicate
      const currentBranch = siblingBranches.find(
        (b) => b.historyIndex === currentDisplayedHistoryIndex
      )
      if (currentBranch) {
        uniqueSiblingBranches.push(currentBranch)
        seenMessageIds.add(currentBranch.messageId)
      }

      for (const branch of siblingBranches) {
        if (!seenMessageIds.has(branch.messageId)) {
          uniqueSiblingBranches.push(branch)
          seenMessageIds.add(branch.messageId)
        }
      }

      const siblingHistoryIndices = uniqueSiblingBranches.map((b) => b.historyIndex)

      // Sort siblings by the timestamp of their diverging user message for consistency
      siblingHistoryIndices.sort((idxA, idxB) => {
        const timeA = histories[idxA][currentMessageIndexInDisplay].timestamp
        const timeB = histories[idxB][currentMessageIndexInDisplay].timestamp
        return timeA - timeB
      })

      const currentPositionInSiblings = siblingHistoryIndices.indexOf(currentDisplayedHistoryIndex)

      return {
        siblings: siblingHistoryIndices,
        currentIndexInSiblings: currentPositionInSiblings,
        totalSiblings: siblingHistoryIndices.length,
      }
    },
    [histories]
  )

  const handleNavigateToSiblingBranch = useCallback(
    (targetIndexWithinSiblingsList: number, siblingsList: number[]) => {
      if (
        siblingsList &&
        targetIndexWithinSiblingsList >= 0 &&
        targetIndexWithinSiblingsList < siblingsList.length
      ) {
        const newActiveHistoryGlobalIndex = siblingsList[targetIndexWithinSiblingsList]
        setActiveHistoryIndex(newActiveHistoryGlobalIndex)
        setEditingInfo(null)
      }
    },
    []
  )

  const fetchAllChats = async () => {
    const db = await dbPromise
    const tx = db.transaction('chats', 'readonly')
    const store = tx.objectStore('chats')
    const index = store.index('updatedAt')
    const chats = await index.getAll()
    setAllChats(chats.reverse())
  }

  const handleSelectChat = (id: string) => {
    const urlParams = new URLSearchParams(window.location.search)
    urlParams.set('id', id)
    const newRelativePathQuery = window.location.pathname + '?' + urlParams.toString()
    window.history.pushState({ path: newRelativePathQuery }, '', newRelativePathQuery)
    setChatId(id)
    setIsChatHistoryOpen(false)
  }

  if (!isExtensionActive) {
    return (
      <div className="chat-app-container">
        <div className="message-list" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <h2 style={{ color: '#00c7e2' }}>
            <a
              href="https://infyverse.space/i/home"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#00c7e2' }}
            >
              Please install the Infyverse extension to continue
            </a>
          </h2>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-app-container">
      <ChatHistoryPopup
        chats={allChats}
        onClose={() => setIsChatHistoryOpen(false)}
        onSelectChat={handleSelectChat}
        anchorEl={chatHistoryAnchorEl}
        open={isChatHistoryOpen}
      />
      <Navigator
        onOpenChatHistory={(event) => {
          setChatHistoryAnchorEl(event.currentTarget as HTMLElement)
          fetchAllChats()
          setIsChatHistoryOpen(true)
        }}
        onNewChat={handleNewChat}
      />
      {isChatLoaded ? (
        currentMessages.length > 0 ? (
          <ChatMessages
            messages={currentMessages}
            historyIndex={activeHistoryIndex}
            onStartEdit={handleStartEdit}
            editingInfo={editingInfo}
            onEditInputChange={handleEditInputChange}
            onSaveEdit={handleSaveEdit}
            onForkEdit={handleForkEdit}
            onCancelEdit={handleCancelEdit}
            findSiblingBranchInfo={findSiblingBranchInfo}
            onNavigateToSiblingBranch={handleNavigateToSiblingBranch}
            onCopyMessage={handleCopyMessage}
            onReplyWithImage={handleReplyWithImage}
          />
        ) : (
          <Welcome />
        )
      ) : (
        <div className="message-list" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div>Loading chat...</div>
        </div>
      )}
      {isLoadingAI && <div className="ai-thinking">AI is thinking...</div>}
      {attachments.length > 0 && (
        <div className="attachment-preview-area">
          {attachments.map((url, index) => (
            <div key={index} className="attachment-item">
              <img src={url} alt="attachment" className="attachment-thumbnail" />
              <button onClick={() => handleRemoveAttachment(url)}>×</button>
            </div>
          ))}
        </div>
      )}
      <MessageInput
        value={currentInput}
        onChange={setCurrentInput}
        onSubmit={handleSendMessage}
        isLoadingAI={isLoadingAI}
        onAttachment={handleAddAttachment}
      />
    </div>
  )
}

export default App
