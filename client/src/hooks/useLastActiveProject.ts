import { useCallback, useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'lava-last-active-project'

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function getServerSnapshot(): string | null {
  return null
}

function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

export function useLastActiveProject(): {
  lastProjectId: string | null
  setLastProjectId: (id: string) => void
  clearLastProjectId: () => void
} {
  const lastProjectId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setLastProjectId = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {}
    // Trigger re-render for same-tab consumers
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  const clearLastProjectId = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
  }, [])

  return useMemo(
    () => ({ lastProjectId, setLastProjectId, clearLastProjectId }),
    [lastProjectId, setLastProjectId, clearLastProjectId],
  )
}
