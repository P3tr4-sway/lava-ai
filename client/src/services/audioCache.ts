/**
 * IndexedDB-based audio buffer cache with LRU eviction.
 *
 * Persists decoded audio ArrayBuffers across page reloads so that repeated
 * playback of the same clip avoids re-fetching from the server.
 *
 * ---------------------------------------------------------------------------
 * Integration with ToneEngine.loadBuffer()  (client/src/audio/ToneEngine.ts)
 * ---------------------------------------------------------------------------
 *
 * In ToneEngine.loadBuffer(), insert a cache layer between the in-memory
 * Map check and the network fetch:
 *
 *   async loadBuffer(audioFileId: string): Promise<AudioBuffer> {
 *     if (this.bufferCache.has(audioFileId)) {
 *       return this.bufferCache.get(audioFileId)!
 *     }
 *
 *     // --- 1. Check IndexedDB cache ---
 *     const cached = await audioCache.get(audioFileId)
 *     if (cached) {
 *       const ctx = Tone.getContext().rawContext as AudioContext
 *       const audioBuf = await ctx.decodeAudioData(cached.buffer.slice(0))
 *       this.bufferCache.set(audioFileId, audioBuf)
 *       return audioBuf
 *     }
 *
 *     await this.init()
 *
 *     // --- 2. Fetch from network ---
 *     const url = `/api/audio/${audioFileId}`
 *     const response = await fetch(url)
 *     const arrayBuffer = await response.arrayBuffer()
 *
 *     const ctx = Tone.getContext().rawContext as AudioContext
 *     const raw = await ctx.decodeAudioData(arrayBuffer.slice(0))
 *
 *     // --- 3. Persist to IndexedDB cache ---
 *     await audioCache.put(audioFileId, arrayBuffer, raw.sampleRate, raw.numberOfChannels)
 *
 *     this.bufferCache.set(audioFileId, raw)
 *     return raw
 *   }
 *
 * ---------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'lava-audio-cache'
const DB_VERSION = 1
const STORE_BUFFERS = 'buffers'
const STORE_META = 'meta'
const META_TOTAL_SIZE_KEY = 'totalSize'

/** Maximum cache size in bytes (500 MB). */
const MAX_CACHE_BYTES = 500 * 1024 * 1024

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CacheEntry {
  id: string
  buffer: ArrayBuffer
  sampleRate: number
  channels: number
  cachedAt: number
  sizeBytes: number
}

interface CacheStats {
  totalSize: number
  entryCount: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Open (or create) the IndexedDB database. */
function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE_BUFFERS)) {
        const store = db.createObjectStore(STORE_BUFFERS, { keyPath: 'id' })
        // Index on cachedAt so we can iterate oldest-first for LRU eviction
        store.createIndex('byCachedAt', 'cachedAt', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Wrap an IDBRequest in a Promise. */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Wrap an IDBTransaction completion in a Promise. */
function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}

/** Read the persisted totalSize from the meta store. */
async function readTotalSize(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(STORE_META, 'readonly')
  const store = tx.objectStore(STORE_META)
  const value = await promisifyRequest<number | undefined>(store.get(META_TOTAL_SIZE_KEY))
  return value ?? 0
}

/** Write the totalSize value to the meta store (within an existing rw tx). */
function writeTotalSizeInTx(metaStore: IDBObjectStore, totalSize: number): void {
  metaStore.put(totalSize, META_TOTAL_SIZE_KEY)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const audioCache = {
  /**
   * Retrieve a cached audio buffer by its file ID.
   * Returns `null` if the entry does not exist.
   */
  async get(
    audioFileId: string,
  ): Promise<{ buffer: ArrayBuffer; sampleRate: number; channels: number } | null> {
    const db = await openDB()
    try {
      const tx = db.transaction(STORE_BUFFERS, 'readonly')
      const store = tx.objectStore(STORE_BUFFERS)
      const entry = await promisifyRequest<CacheEntry | undefined>(store.get(audioFileId))

      if (!entry) return null

      return {
        buffer: entry.buffer,
        sampleRate: entry.sampleRate,
        channels: entry.channels,
      }
    } finally {
      db.close()
    }
  },

  /**
   * Store an audio buffer in the cache.
   *
   * If adding the entry would push the cache over the 500 MB budget, the
   * oldest entries (by `cachedAt`) are evicted first (LRU).
   */
  async put(
    audioFileId: string,
    buffer: ArrayBuffer,
    sampleRate: number,
    channels: number,
  ): Promise<void> {
    const db = await openDB()
    try {
      const newSize = buffer.byteLength

      // Single entry larger than the entire budget — skip caching
      if (newSize > MAX_CACHE_BYTES) return

      // -- Read current total and check if we need to evict --
      let currentTotal = await readTotalSize(db)

      // If we are replacing an existing entry, subtract its old size first
      {
        const peekTx = db.transaction(STORE_BUFFERS, 'readonly')
        const peekStore = peekTx.objectStore(STORE_BUFFERS)
        const existing = await promisifyRequest<CacheEntry | undefined>(
          peekStore.get(audioFileId),
        )
        if (existing) {
          currentTotal -= existing.sizeBytes
        }
      }

      // -- Evict oldest entries until there is room --
      if (currentTotal + newSize > MAX_CACHE_BYTES) {
        const evictTx = db.transaction([STORE_BUFFERS, STORE_META], 'readwrite')
        const bufferStore = evictTx.objectStore(STORE_BUFFERS)
        const metaStore = evictTx.objectStore(STORE_META)
        const index = bufferStore.index('byCachedAt')

        let evictedBytes = 0
        const target = currentTotal + newSize - MAX_CACHE_BYTES

        await new Promise<void>((resolve, reject) => {
          const cursorReq = index.openCursor() // ascending = oldest first

          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (!cursor || evictedBytes >= target) {
              // Done evicting — update meta
              writeTotalSizeInTx(metaStore, currentTotal - evictedBytes)
              resolve()
              return
            }

            const entry = cursor.value as CacheEntry

            // Don't evict the entry we are about to overwrite
            if (entry.id !== audioFileId) {
              evictedBytes += entry.sizeBytes
              cursor.delete()
            }

            cursor.continue()
          }

          cursorReq.onerror = () => reject(cursorReq.error)
        })

        await promisifyTransaction(evictTx)
        currentTotal -= evictedBytes
      }

      // -- Write the new entry + update totalSize --
      const writeTx = db.transaction([STORE_BUFFERS, STORE_META], 'readwrite')
      const writeBufferStore = writeTx.objectStore(STORE_BUFFERS)
      const writeMetaStore = writeTx.objectStore(STORE_META)

      const entry: CacheEntry = {
        id: audioFileId,
        buffer,
        sampleRate,
        channels,
        cachedAt: Date.now(),
        sizeBytes: newSize,
      }

      writeBufferStore.put(entry)
      writeTotalSizeInTx(writeMetaStore, currentTotal + newSize)

      await promisifyTransaction(writeTx)
    } finally {
      db.close()
    }
  },

  /** Remove a single entry from the cache. */
  async remove(audioFileId: string): Promise<void> {
    const db = await openDB()
    try {
      // Read existing entry size
      const peekTx = db.transaction(STORE_BUFFERS, 'readonly')
      const peekStore = peekTx.objectStore(STORE_BUFFERS)
      const existing = await promisifyRequest<CacheEntry | undefined>(
        peekStore.get(audioFileId),
      )

      if (!existing) return

      const tx = db.transaction([STORE_BUFFERS, STORE_META], 'readwrite')
      const bufferStore = tx.objectStore(STORE_BUFFERS)
      const metaStore = tx.objectStore(STORE_META)

      bufferStore.delete(audioFileId)

      const currentTotal = await promisifyRequest<number | undefined>(
        metaStore.get(META_TOTAL_SIZE_KEY),
      )
      writeTotalSizeInTx(metaStore, Math.max(0, (currentTotal ?? 0) - existing.sizeBytes))

      await promisifyTransaction(tx)
    } finally {
      db.close()
    }
  },

  /** Delete every entry and reset the size counter. */
  async clear(): Promise<void> {
    const db = await openDB()
    try {
      const tx = db.transaction([STORE_BUFFERS, STORE_META], 'readwrite')
      tx.objectStore(STORE_BUFFERS).clear()
      writeTotalSizeInTx(tx.objectStore(STORE_META), 0)
      await promisifyTransaction(tx)
    } finally {
      db.close()
    }
  },

  /** Return aggregate stats about the cache. */
  async getStats(): Promise<CacheStats> {
    const db = await openDB()
    try {
      const tx = db.transaction([STORE_BUFFERS, STORE_META], 'readonly')
      const bufferStore = tx.objectStore(STORE_BUFFERS)
      const metaStore = tx.objectStore(STORE_META)

      const [totalSize, entryCount] = await Promise.all([
        promisifyRequest<number | undefined>(metaStore.get(META_TOTAL_SIZE_KEY)),
        promisifyRequest<number>(bufferStore.count()),
      ])

      return {
        totalSize: totalSize ?? 0,
        entryCount,
      }
    } finally {
      db.close()
    }
  },
}
