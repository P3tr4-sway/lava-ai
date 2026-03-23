import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lava-leadsheet-draft'
const DEBOUNCE_MS = 3_000

// ─── Types ──────────────────────────────────────────────────────────────────

interface UseLeadSheetAutoSaveReturn {
  saveDraft: (state: unknown) => void
  restoreDraft: () => unknown | null
  clearDraft: () => void
  hasDraft: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readStorage(): unknown | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function writeStorage(state: unknown): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('[useLeadSheetAutoSave] sessionStorage write failed:', err)
  }
}

function removeStorage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Swallow — best effort
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLeadSheetAutoSave(): UseLeadSheetAutoSaveReturn {
  const [hasDraft, setHasDraft] = useState(() => readStorage() !== null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check for existing draft on mount
  useEffect(() => {
    setHasDraft(readStorage() !== null)
  }, [])

  const saveDraft = useCallback((state: unknown) => {
    // Debounced write
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      writeStorage(state)
      setHasDraft(true)
    }, DEBOUNCE_MS)
  }, [])

  const restoreDraft = useCallback((): unknown | null => {
    return readStorage()
  }, [])

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    removeStorage()
    setHasDraft(false)
  }, [])

  // Clean up pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { saveDraft, restoreDraft, clearDraft, hasDraft }
}
