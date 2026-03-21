// ─── IndexedDB Draft Store ──────────────────────────────────────────────────
//
// Persists project draft snapshots to IndexedDB so unsaved work survives
// page reloads, browser crashes, and accidental navigation.

const DB_NAME = 'lava-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

export interface DraftEntry {
  projectId: string
  snapshot: unknown
  updatedAt: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'projectId' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txn(
  mode: IDBTransactionMode,
): Promise<{ store: IDBObjectStore; done: Promise<void> }> {
  return openDb().then((db) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return { store, done }
  })
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const draftStore = {
  async saveDraft(projectId: string, snapshot: unknown): Promise<void> {
    const entry: DraftEntry = { projectId, snapshot, updatedAt: Date.now() }
    const { store, done } = await txn('readwrite')
    store.put(entry)
    await done
  },

  async getDraft(projectId: string): Promise<DraftEntry | null> {
    const { store } = await txn('readonly')
    const result = await reqToPromise<DraftEntry | undefined>(store.get(projectId))
    return result ?? null
  },

  async removeDraft(projectId: string): Promise<void> {
    const { store, done } = await txn('readwrite')
    store.delete(projectId)
    await done
  },

  async listDrafts(): Promise<DraftEntry[]> {
    const { store } = await txn('readonly')
    const index = store.index('updatedAt')
    const items = await reqToPromise<DraftEntry[]>(index.getAll())
    // Return newest-first
    return items.reverse()
  },

  async clear(): Promise<void> {
    const { store, done } = await txn('readwrite')
    store.clear()
    await done
  },
}
