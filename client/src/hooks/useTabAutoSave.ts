/**
 * useTabAutoSave — localStorage auto-save for the alphaTex tab editor.
 *
 * - Auto-saves the AST to localStorage every 10 seconds
 * - Cmd+S (Mac) / Ctrl+S (Win/Linux) → downloadAst() to trigger a .json download
 * - Returns { hasSavedState, loadSaved } so the caller can offer a restore prompt
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTabEditorStore } from '@/stores/tabEditorStore'
import {
  autoSave,
  loadAutoSave,
  downloadAst,
  AUTOSAVE_INTERVAL_MS,
} from '@/io/json'
import type { ScoreNode } from '@/editor/ast/types'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseTabAutoSaveOptions {
  /** Set to false to disable both the interval and the Cmd+S handler */
  enabled?: boolean
}

// ---------------------------------------------------------------------------
// Return value
// ---------------------------------------------------------------------------

export interface UseTabAutoSaveReturn {
  /** True when there is a previously saved AST in localStorage */
  hasSavedState: boolean
  /** Call this to restore the saved AST into the store */
  loadSaved: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTabAutoSave(opts: UseTabAutoSaveOptions = {}): UseTabAutoSaveReturn {
  const { enabled = true } = opts

  const [hasSavedState, setHasSavedState] = useState<boolean>(false)

  // Check for existing saved state on mount
  useEffect(() => {
    if (!enabled) return
    const saved = loadAutoSave()
    setHasSavedState(saved !== null)
  }, [enabled])

  // ---------------------------------------------------------------------------
  // Interval auto-save (every 10 s)
  // ---------------------------------------------------------------------------
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) return

    intervalRef.current = setInterval(() => {
      const ast = useTabEditorStore.getState().ast
      if (ast) {
        autoSave(ast)
        setHasSavedState(true)
      }
    }, AUTOSAVE_INTERVAL_MS)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled])

  // ---------------------------------------------------------------------------
  // Cmd+S / Ctrl+S → download .json file
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.metaKey || event.ctrlKey
      if (!isCtrlOrCmd || event.key !== 's') return
      event.preventDefault()

      const ast = useTabEditorStore.getState().ast
      if (!ast) return

      // Also persist to localStorage on manual save
      autoSave(ast)
      setHasSavedState(true)

      downloadAst(ast)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])

  // ---------------------------------------------------------------------------
  // loadSaved — restore the AST from localStorage into the store
  // ---------------------------------------------------------------------------
  const loadSaved = useCallback(() => {
    const saved: ScoreNode | null = loadAutoSave()
    if (!saved) return
    useTabEditorStore.getState().setAst(saved)
  }, [])

  return { hasSavedState, loadSaved }
}
