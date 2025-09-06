export interface Message {
  id: string | number
  text: string
  sender: 'user' | 'assistant' | string
  timestamp: number
  attachments?: string[]
}

export interface ChatSession {
  id: string
  chatData: Message[][]
  lastActiveBranchIndex: number
  updatedAt: Date
  title: string
}

export interface EditingInfo {
  historyIndex: number
  messageIndex: number
  currentEditText: string
}

export interface ToolsPopupPosition {
  top: number
  left: number
}

export interface ToolCalls {
  tool_calls: any[]
}

export interface GenerativePart {
  inlineData: {
    data: string
    mimeType: string
  }
}

export interface Tool {
  name: string
  description: string
  paramsSchema: object
  callback: (args: any) => Promise<any>
  tags?: string[]
  sourceUrl?: string
  enabled?: boolean
}
