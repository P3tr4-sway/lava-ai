// ─── In-memory query cache singleton ─────────────────────────────────────────

interface CacheEntry<T = unknown> {
  data: T
  fetchedAt: number
  staleAt: number
  expiresAt: number
}

type InvalidationListener = (invalidatedKeys: string[]) => void

const cache = new Map<string, CacheEntry>()
const listeners = new Set<InvalidationListener>()

function notifyListeners(keys: string[]) {
  if (keys.length === 0) return
  for (const listener of listeners) {
    listener(keys)
  }
}

/** Remove expired entries from the cache. Runs on a 60s interval. */
function gc() {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) {
      cache.delete(key)
    }
  }
}

// Start garbage collection interval
const GC_INTERVAL_MS = 60_000
let gcTimer: ReturnType<typeof setInterval> | null = null

function ensureGc() {
  if (gcTimer === null) {
    gcTimer = setInterval(gc, GC_INTERVAL_MS)
  }
}

ensureGc()

export const queryCache = {
  get<T>(key: string): CacheEntry<T> | null {
    const entry = cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    // Expired — delete and return null
    if (Date.now() > entry.expiresAt) {
      cache.delete(key)
      return null
    }

    return entry
  },

  set<T>(key: string, data: T, staleTime: number, cacheTime: number): void {
    const now = Date.now()
    cache.set(key, {
      data,
      fetchedAt: now,
      staleAt: now + staleTime,
      expiresAt: now + cacheTime,
    })
  },

  /**
   * Invalidate an exact key, or all keys that start with the given prefix.
   * A trailing `*` on the string triggers prefix matching.
   * Without `*`, exact-match is tried first, then prefix match as fallback.
   */
  invalidate(keyOrPrefix: string): void {
    const invalidated: string[] = []

    if (keyOrPrefix.endsWith('*')) {
      const prefix = keyOrPrefix.slice(0, -1)
      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
          cache.delete(key)
          invalidated.push(key)
        }
      }
    } else {
      // Exact match first
      if (cache.has(keyOrPrefix)) {
        cache.delete(keyOrPrefix)
        invalidated.push(keyOrPrefix)
      }
      // Also invalidate any sub-keys that start with this prefix
      for (const key of cache.keys()) {
        if (key !== keyOrPrefix && key.startsWith(keyOrPrefix)) {
          cache.delete(key)
          invalidated.push(key)
        }
      }
    }

    notifyListeners(invalidated)
  },

  invalidateAll(): void {
    const keys = [...cache.keys()]
    cache.clear()
    notifyListeners(keys)
  },

  /**
   * Subscribe to cache invalidation events.
   * Returns an unsubscribe function.
   */
  subscribe(listener: InvalidationListener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
