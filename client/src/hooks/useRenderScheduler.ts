/**
 * useRenderScheduler — React hook that wires RenderScheduler to the
 * tab editor store.
 *
 * Subscribes to tabEditorStore.ast changes and schedules a render via the
 * RenderScheduler. For undo/redo (detected by the undo-stack shrinking or
 * the redo-stack shrinking) the scheduler renders synchronously so the
 * UI responds immediately rather than waiting for the next rAF frame.
 */

import { useEffect, useRef } from 'react'
import { useTabEditorStore } from '../stores/tabEditorStore'
import { RenderScheduler } from '../render/renderScheduler'
import type { AlphaTabBridge } from '../render/alphaTabBridge'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Wire up a RenderScheduler to the tab editor store.
 *
 * @param bridgeRef - Ref to the AlphaTabBridge instance (may be null until
 *   alphaTab finishes initialising).
 *
 * @returns A ref to the RenderScheduler (stable across renders). Useful for
 *   accessing perf stats in benchmarks or dev tools.
 */
export function useRenderScheduler(
  bridgeRef: React.RefObject<AlphaTabBridge | null>,
): React.RefObject<RenderScheduler | null> {
  const schedulerRef = useRef<RenderScheduler | null>(null)

  useEffect(() => {
    // Track the previous undo/redo stack depths so we can detect when an
    // undo or redo action fired (undo-stack shrinks = undo; redo-stack
    // shrinks = redo).
    let prevUndoDepth = useTabEditorStore.getState().history.getUndoStackDepth()
    let prevRedoDepth = useTabEditorStore.getState().history.getRedoStackDepth()

    const unsubscribe = useTabEditorStore.subscribe((state, prevState) => {
      // Skip if AST unchanged
      if (state.ast === prevState.ast || state.ast === null) return

      const bridge = bridgeRef.current
      if (!bridge) return

      // Lazily create the scheduler once the bridge is available
      if (!schedulerRef.current) {
        schedulerRef.current = new RenderScheduler(bridge)
      }

      const scheduler = schedulerRef.current

      const currentUndoDepth = state.history.getUndoStackDepth()
      const currentRedoDepth = state.history.getRedoStackDepth()

      // Undo: undo-stack shrank (a command was popped)
      // Redo: redo-stack shrank (a command was re-applied)
      const isUndoRedo =
        currentUndoDepth < prevUndoDepth || currentRedoDepth < prevRedoDepth

      prevUndoDepth = currentUndoDepth
      prevRedoDepth = currentRedoDepth

      if (isUndoRedo) {
        // Undo/redo — render synchronously for immediate visual feedback
        scheduler.renderNow(state.ast)
      } else {
        // Normal edit — batch into next rAF/idle frame
        scheduler.schedule(state.ast)
      }
    })

    return () => {
      unsubscribe()
      schedulerRef.current?.destroy()
      schedulerRef.current = null
    }
  }, [bridgeRef])

  return schedulerRef
}
