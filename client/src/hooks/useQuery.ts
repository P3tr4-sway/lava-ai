import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { queryCache } from '@/services/queryCache'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseQueryOptions<T> {
  /** Milliseconds before data is considered stale and a background refetch starts (default 30_000) */
  staleTime?: number
  /** Milliseconds before the cache entry is evicted entirely (default 300_000) */
  cacheTime?: number
  /** Refetch when window regains focus if data is stale (default true) */
  refetchOnFocus?: boolean
  /** Skip fetching when false (default true) */
  enabled?: boolean
  /** Transform raw response before caching */
  select?: (raw: T) => T
}

interface UseQueryResult<T> {
  data: T | undefined
  error: Error | null
  /** True when there is no cached data and the first fetch is in progress */
  isLoading: boolean
  /** True when any fetch is in progress (including background refetches) */
  isFetching: boolean
  /** True when cached data exists but is past its staleAt timestamp */
  isStale: boolean
  /** Manually trigger a refetch */
  refetch: () => Promise<void>
}

// ─── In-flight deduplication ─────────────────────────────────────────────────

const inflightRequests = new Map<string, Promise<unknown>>()

// ─── Cache snapshot subscription (for useSyncExternalStore) ──────────────────

let cacheVersion = 0

function subscribeToCacheChanges(onStoreChange: () => void): () => void {
  return queryCache.subscribe(() => {
    cacheVersion += 1
    onStoreChange()
  })
}

function getCacheSnapshot(): number {
  return cacheVersion
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const DEFAULT_STALE_TIME = 30_000
const DEFAULT_CACHE_TIME = 300_000

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: UseQueryOptions<T>,
): UseQueryResult<T> {
  const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME
  const cacheTime = options?.cacheTime ?? DEFAULT_CACHE_TIME
  const refetchOnFocus = options?.refetchOnFocus ?? true
  const enabled = options?.enabled ?? true
  const selectFn = options?.select

  const [data, setData] = useState<T | undefined>(() => {
    const entry = queryCache.get<T>(key)
    return entry ? (selectFn ? selectFn(entry.data) : entry.data) : undefined
  })
  const [error, setError] = useState<Error | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  // Track the latest key & fetcher in refs so callbacks never go stale
  const keyRef = useRef(key)
  const fetcherRef = useRef(fetcher)
  const selectRef = useRef(selectFn)
  keyRef.current = key
  fetcherRef.current = fetcher
  selectRef.current = selectFn

  // Subscribe to external cache invalidations so the component re-renders
  useSyncExternalStore(subscribeToCacheChanges, getCacheSnapshot)

  // ── Core fetch logic ────────────────────────────────────────────────────

  const doFetch = useCallback(
    async (isBackgroundRefetch: boolean) => {
      const currentKey = keyRef.current

      // Deduplicate: reuse in-flight request for the same key
      const existing = inflightRequests.get(currentKey) as Promise<T> | undefined
      if (existing) {
        if (!isBackgroundRefetch) setIsFetching(true)
        try {
          const result = await existing
          const transformed = selectRef.current ? selectRef.current(result) : result
          setData(transformed)
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
          if (!isBackgroundRefetch) setIsFetching(false)
        }
        return
      }

      setIsFetching(true)

      const promise = fetcherRef.current()
      inflightRequests.set(currentKey, promise)

      try {
        const result = await promise
        queryCache.set(currentKey, result, staleTime, cacheTime)
        const transformed = selectRef.current ? selectRef.current(result) : result

        // Only update state if the key hasn't changed while we were fetching
        if (keyRef.current === currentKey) {
          setData(transformed)
          setError(null)
        }
      } catch (err) {
        if (keyRef.current === currentKey) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        inflightRequests.delete(currentKey)
        if (keyRef.current === currentKey) {
          setIsFetching(false)
        }
      }
    },
    [staleTime, cacheTime],
  )

  // ── Mount / key change effect ───────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const entry = queryCache.get<T>(key)

    if (entry) {
      const transformed = selectRef.current ? selectRef.current(entry.data) : entry.data
      setData(transformed)
      setError(null)

      const now = Date.now()
      if (now >= entry.staleAt) {
        // Stale — background refetch
        doFetch(true)
      }
    } else {
      // No cache — full fetch
      setData(undefined)
      doFetch(false)
    }
  }, [key, enabled, doFetch])

  // ── Window focus refetch ────────────────────────────────────────────────

  useEffect(() => {
    if (!refetchOnFocus || !enabled) return

    function handleFocus() {
      const entry = queryCache.get<T>(keyRef.current)
      if (!entry || Date.now() >= entry.staleAt) {
        doFetch(true)
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') handleFocus()
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refetchOnFocus, enabled, doFetch])

  // ── Cache invalidation refetch ──────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const unsubscribe = queryCache.subscribe((invalidatedKeys) => {
      if (invalidatedKeys.includes(keyRef.current)) {
        doFetch(false)
      }
    })

    return unsubscribe
  }, [enabled, doFetch])

  // ── Derived state ───────────────────────────────────────────────────────

  const isLoading = data === undefined && isFetching
  const entry = queryCache.get<T>(key)
  const isStale = entry ? Date.now() >= entry.staleAt : true

  const refetch = useCallback(async () => {
    await doFetch(false)
  }, [doFetch])

  return { data, error, isLoading, isFetching, isStale, refetch }
}
