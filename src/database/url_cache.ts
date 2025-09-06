const DB_NAME = 'url-cache'
const STORE_NAME = 'urls'

interface CachedUrl {
  id: string
  blob: Blob
}

class UrlCache {
  private db: IDBDatabase | null = null

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve()
      }

      request.onerror = (event: Event) => {
        console.error('Error opening IndexedDB:', (event.target as IDBOpenDBRequest).error)
        reject((event.target as IDBOpenDBRequest).error)
      }
    })
  }

  async getUrl(id: string): Promise<CachedUrl | undefined> {
    if (!this.db) {
      await this.open()
    }

    return new Promise((resolve, reject) => {
      const transaction = (this.db as IDBDatabase).transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBRequest).result)
      }

      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }

  async addUrl(id: string, blob: Blob): Promise<void> {
    if (!this.db) {
      await this.open()
    }

    return new Promise((resolve, reject) => {
      const transaction = (this.db as IDBDatabase).transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({ id, blob })

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = (event: Event) => {
        reject((event.target as IDBRequest).error)
      }
    })
  }
}

export default new UrlCache()
