import { openDB, IDBPDatabase } from 'idb'

export interface Chat {
  id: string
  chatData: any[]
  lastActiveBranchIndex: number
  updatedAt: Date
  title: string
}

const DB_NAME = 'i/chat'
const DB_VERSION = 1

interface ToolState {
  enabled: boolean
}

interface ToolData {
  url: string
  tools: Record<string, ToolState>
}

// --- DATABASE SETUP ---
export const dbPromise: Promise<IDBPDatabase> = openDB(DB_NAME, DB_VERSION, {
  upgrade(db: IDBPDatabase, oldVersion: number, newVersion: number | null, transaction: any) {
    if (!db.objectStoreNames.contains('chats')) {
      db.createObjectStore('chats', { keyPath: 'id' })
    }

    const chatStore = transaction.objectStore('chats')
    if (!chatStore.indexNames.contains('updatedAt')) {
      chatStore.createIndex('updatedAt', 'updatedAt')
    }

    if (!db.objectStoreNames.contains('tools')) {
      db.createObjectStore('tools', { keyPath: 'url' })
    }
  },
})

/**
 * Adds a tool URL to the database if it doesn't exist,
 * and initializes its tools map.
 * @param {string} url
 * @returns {Promise<void>}
 */
export async function addToolUrl(url: string): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction('tools', 'readwrite')
  const store = tx.objectStore('tools')
  const existing = await store.get(url)
  if (!existing) {
    await store.put({ url, tools: {} })
  }
  await tx.done
}

/**
 * Sets the enabled state for a specific tool from a given URL.
 * @param {string} url
 * @param {string} toolName
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
export async function setToolState(url: string, toolName: string, enabled: boolean): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction('tools', 'readwrite')
  const store = tx.objectStore('tools')
  const toolData: ToolData | undefined = await store.get(url)

  if (toolData) {
    if (!toolData.tools) {
      toolData.tools = {}
    }
    toolData.tools[toolName] = { enabled }
    await store.put(toolData)
  }
  await tx.done
}

/**
 * Retrieves all tool data from the database.
 * Ensures that the default tool URL is always present.
 * @returns {Promise<ToolData[]>}
 */
export async function getAllToolData(): Promise<ToolData[]> {
  const db = await dbPromise
  const tx = db.transaction('tools', 'readwrite')
  const store = tx.objectStore('tools')
  const defaultToolUrl = 'https://infyverse.space/i/chat/tools.json'
  const existing = await store.get(defaultToolUrl)
  if (!existing) {
    await store.put({ url: defaultToolUrl, tools: {} })
  }
  const allData = await store.getAll()
  await tx.done
  return allData
}

/**
 * Deletes a tool URL and its associated data from the database.
 * @param {string} url
 * @returns {Promise<void>}
 */
export async function deleteToolUrl(url: string): Promise<void> {
  const db = await dbPromise
  await db.delete('tools', url)
}
