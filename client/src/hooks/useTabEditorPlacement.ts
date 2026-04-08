/**
 * useTabEditorPlacement — hover hit-test and click-to-select for the alphaTex canvas.
 *
 * Translates raw mouse events over the alphaTab container into:
 *   - hoverState: the currently hovered beat position + snapped coordinates
 *   - event handlers to wire onto the scroll wrapper div
 *
 * On click, calls the provided onBeatClick callback with the resolved HitPosition
 * so the caller (useTabEditorInput.handleBeatClick) can enter insert mode.
 */

import { useRef, useState, useCallback } from 'react'
import type React from 'react'
import type { AlphaTabBridge, HitPosition } from '../render/alphaTabBridge'
import { hitTest } from '../editor/hit-test/hitTest'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HoverState {
  hit: HitPosition
  /** Center X of the beat column in alphaTab coordinate space */
  beatCenterX: number
  /** Raw mouse Y — already encodes the correct string line position */
  mouseY: number
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTabEditorPlacement(
  bridgeRef: React.RefObject<AlphaTabBridge | null>,
  containerRef: React.RefObject<HTMLElement | null>,
  stringCount: number,
  onBeatClick: (hit: HitPosition) => void,
): {
  handleMouseMove: (e: React.MouseEvent) => void
  handleMouseLeave: () => void
  handleClick: (e: React.MouseEvent) => void
  hoverState: HoverState | null
} {
  const [hoverState, setHoverState] = useState<HoverState | null>(null)

  // Keep latest hover hit in a ref so handleClick can read it synchronously.
  const lastHitRef = useRef<HoverState | null>(null)

  const resolve = useCallback(
    (e: React.MouseEvent): HoverState | null => {
      const bridge = bridgeRef.current
      const container = containerRef.current
      if (!bridge || !container) return null

      const lookup = bridge.getBoundsLookup()
      if (!lookup) return null

      // Translate to alphaTab coordinate space (container-relative)
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + container.scrollLeft
      const y = e.clientY - rect.top + container.scrollTop

      const hit = hitTest(lookup, x, y, stringCount)
      if (!hit) return null

      // Get beat bounds to compute the column center X
      const beatRect = bridge.getBeatRect(
        hit.trackIndex,
        hit.barIndex,
        hit.voiceIndex,
        hit.beatIndex,
      )

      return {
        hit,
        beatCenterX: beatRect ? beatRect.x + beatRect.w / 2 : x,
        mouseY: y,
      }
    },
    [bridgeRef, containerRef, stringCount],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const state = resolve(e)
      lastHitRef.current = state
      setHoverState(state)
    },
    [resolve],
  )

  const handleMouseLeave = useCallback(() => {
    lastHitRef.current = null
    setHoverState(null)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Re-resolve on click to get the freshest position (in case the user
      // clicked without first moving, e.g. a programmatic click).
      const state = resolve(e) ?? lastHitRef.current
      if (!state) return
      onBeatClick(state.hit)
    },
    [resolve, onBeatClick],
  )

  return { handleMouseMove, handleMouseLeave, handleClick, hoverState }
}
