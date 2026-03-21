import { useState, useEffect, useRef, useCallback } from 'react'
import { draftStore } from '@/services/draftStore'

// ─── Types ──────────────────────────────────────────────────────────────────

interface UseAutoSaveOptions {
  projectId: string | null
  getData: () => unknown
  isDirty: boolean
  debounceMs?: number
  serverSaveMs?: number
  onServerSave?: (data: unknown) => Promise<void>
}

interface UseAutoSaveReturn {
  hasDraft: boolean
  restoreDraft: () => Promise<unknown | null>
  discardDraft: () => Promise<void>
}

// ─── Default intervals ──────────────────────────────────────────────────────

const DEFAULT_DEBOUNCE_MS = 5_000
const DEFAULT_SERVER_SAVE_MS = 30_000

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
  const {
    projectId,
    getData,
    isDirty,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    serverSaveMs = DEFAULT_SERVER_SAVE_MS,
    onServerSave,
  } = options

  const [hasDraft, setHasDraft] = useState(false)

  // Keep latest values in refs so timers always see current state without
  // causing re-subscriptions when the values change.
  const getDataRef = useRef(getData)
  getDataRef.current = getData

  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  const onServerSaveRef = useRef(onServerSave)
  onServerSaveRef.current = onServerSave

  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId

  // Timer refs
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Save to IndexedDB ───────────────────────────────────────────────────

  const saveToIdb = useCallback(async () => {
    const id = projectIdRef.current
    if (!id) return
    try {
      const snapshot = getDataRef.current()
      await draftStore.saveDraft(id, snapshot)
      setHasDraft(true)
    } catch (err) {
      console.error('[useAutoSave] IndexedDB save failed:', err)
    }
  }, [])

  // ── Save to server ──────────────────────────────────────────────────────

  const saveToServer = useCallback(async () => {
    const id = projectIdRef.current
    const handler = onServerSaveRef.current
    if (!id || !handler || !isDirtyRef.current) return

    try {
      const snapshot = getDataRef.current()
      await handler(snapshot)
      // Server save succeeded — remove local draft, clear dirty flag
      await draftStore.removeDraft(id)
      setHasDraft(false)
    } catch (err) {
      console.error('[useAutoSave] Server save failed:', err)
    }
  }, [])

  // ── Check for existing draft on mount ───────────────────────────────────

  useEffect(() => {
    if (!projectId) {
      setHasDraft(false)
      return
    }
    let cancelled = false
    draftStore.getDraft(projectId).then((entry) => {
      if (!cancelled && entry) {
        setHasDraft(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  // ── Debounced IDB save when dirty ───────────────────────────────────────

  useEffect(() => {
    if (!projectId || !isDirty) {
      // Clear pending debounce if no longer dirty
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
      return
    }

    debounceTimer.current = setTimeout(() => {
      saveToIdb()
    }, debounceMs)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
    }
  }, [projectId, isDirty, debounceMs, saveToIdb])

  // ── Periodic server save ────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !onServerSave) return

    serverTimer.current = setInterval(() => {
      if (isDirtyRef.current) {
        saveToServer()
      }
    }, serverSaveMs)

    return () => {
      if (serverTimer.current) {
        clearInterval(serverTimer.current)
        serverTimer.current = null
      }
    }
  }, [projectId, serverSaveMs, onServerSave, saveToServer])

  // ── Final save on unmount ───────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (isDirtyRef.current && projectIdRef.current) {
        // Fire-and-forget — component is unmounting
        const id = projectIdRef.current
        const snapshot = getDataRef.current()
        draftStore.saveDraft(id, snapshot).catch(() => {
          // Swallow — best effort
        })
      }
    }
  }, [])

  // ── Consumer actions ────────────────────────────────────────────────────

  const restoreDraft = useCallback(async (): Promise<unknown | null> => {
    if (!projectId) return null
    const entry = await draftStore.getDraft(projectId)
    return entry?.snapshot ?? null
  }, [projectId])

  const discardDraft = useCallback(async (): Promise<void> => {
    if (!projectId) return
    await draftStore.removeDraft(projectId)
    setHasDraft(false)
  }, [projectId])

  return { hasDraft, restoreDraft, discardDraft }
}
