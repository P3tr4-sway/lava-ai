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
import type { BarSpan } from '../editor/selection/SelectionModel'

// ---------------------------------------------------------------------------
// Internal alphaTab boundsLookup shape (mirrors what we need from the runtime
// boundsLookup tree — kept narrow because we only use it for click-fallback
// resolution).
// ---------------------------------------------------------------------------

interface AlphaBoundsLike {
  x: number
  y: number
  w: number
  h: number
}

interface AlphaMasterBarBoundsLite {
  index: number
  visualBounds: AlphaBoundsLike
  bars: Array<{
    visualBounds: AlphaBoundsLike
    realBounds?: AlphaBoundsLike
    lineAlignedBounds?: AlphaBoundsLike
  }>
}

interface AlphaStaffSystemLite {
  visualBounds: AlphaBoundsLike
  bars: AlphaMasterBarBoundsLite[]
}

interface AlphaBoundsLookupLite {
  staffSystems: AlphaStaffSystemLite[]
}

/**
 * Walk the bounds tree and find the masterBar whose visualBounds contain
 * (x, y). Returns null when the click is in margins / between systems.
 */
function findBarAtPos(
  lookup: AlphaBoundsLookupLite,
  x: number,
  y: number,
): { barIndex: number } | null {
  for (const system of lookup.staffSystems ?? []) {
    const sb = system.visualBounds
    // Cheap pre-filter on the system's vertical extent.
    if (y < sb.y || y > sb.y + sb.h) continue
    for (const masterBar of system.bars ?? []) {
      const b = masterBar.visualBounds
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return { barIndex: masterBar.index }
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HoverState {
  hit: HitPosition
  /** Center X of the beat column in alphaTab coordinate space */
  beatCenterX: number
  /** Raw mouse Y */
  mouseY: number
  /** Y coordinate of the resolved string line — use this to snap hover glyph */
  stringLineY: number
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTabEditorPlacement(
  bridgeRef: React.RefObject<AlphaTabBridge | null>,
  containerRef: React.RefObject<HTMLElement | null>,
  stringCount: number,
  onBeatClick: (hit: HitPosition) => void,
  onBarDblClick?: (hit: HitPosition, shiftKey: boolean) => void,
  /**
   * Sibelius-style "staff passage" selection: when the click misses every
   * beat but lands inside a bar, fire this with the resolved bar span and
   * the shift modifier (so callers can extend an existing bar selection).
   */
  onBarClick?: (span: BarSpan, shiftKey: boolean) => void,
  /**
   * Click landed outside every bar (margin / between systems). Use this to
   * deselect.
   */
  onClearSelection?: () => void,
  /**
   * Triple-click anywhere inside the score — GP "global selection of the
   * active track". The caller receives the track index the triple-click
   * landed on (defaulting to the current hover track, or 0).
   */
  onSelectAll?: (trackIndex: number) => void,
): {
  handleMouseMove: (e: React.MouseEvent) => void
  handleMouseLeave: () => void
  handleClick: (e: React.MouseEvent) => void
  handleDblClick: (e: React.MouseEvent) => void
  hoverState: HoverState | null
  /** Synchronous ref — always up-to-date, no React re-render needed. */
  hoverRef: React.RefObject<HoverState | null>
} {
  const [hoverState, setHoverState] = useState<HoverState | null>(null)

  // Keep latest hover hit in a ref so handleClick and keydown handlers can
  // read it synchronously without waiting for a React re-render.
  const hoverRef = useRef<HoverState | null>(null)

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
        stringLineY: hit.stringLineY,
      }
    },
    [bridgeRef, containerRef, stringCount],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const state = resolve(e)
      hoverRef.current = state
      setHoverState(state)
    },
    [resolve],
  )

  const handleMouseLeave = useCallback(() => {
    hoverRef.current = null
    setHoverState(null)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const bridge = bridgeRef.current
      const container = containerRef.current
      if (!bridge || !container) return

      const lookupUnknown = bridge.getBoundsLookup()
      if (!lookupUnknown) return

      // Step 0: triple-click anywhere inside the score → GP "global selection".
      // `detail` counts consecutive clicks (double-click-interval window). We
      // handle this before beat / bar resolution so the gesture works whether
      // the user lands on a note, empty bar space, or the staff lines.
      if (e.detail >= 3 && onSelectAll) {
        const trackIndex = hoverRef.current?.hit.trackIndex ?? 0
        onSelectAll(trackIndex)
        return
      }

      // Translate client coords → alphaTab coord space (container-relative +
      // scroll-adjusted).  Matches `resolve()` math above.
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + container.scrollLeft
      const y = e.clientY - rect.top + container.scrollTop

      // Step 1: did the click land directly on a TAB digit (notehead)?
      // alphaTab's `getBeatAtPos` is column-wide — it returns a beat for any
      // click anywhere inside the bar's vertical extent, so it cannot
      // distinguish "digit click" from "empty staff click". hitTest() narrows
      // further: `onNotehead` is only true when (x, y) is inside a rendered
      // notehead rect. That's the Sibelius split we need — digit = note
      // select, whitespace = bar select.
      const lookup = lookupUnknown as AlphaBoundsLookupLite
      const state = resolve(e) ?? hoverRef.current
      if (state?.hit.onNotehead) {
        onBeatClick(state.hit)
        return
      }

      // Step 2: not on a digit — if the click is inside a bar, route to
      // onBarClick (Sibelius "staff passage" selection). Shift-click extends
      // an existing bar range.
      const bar = findBarAtPos(lookup, x, y)
      if (bar && onBarClick) {
        const trackIndex = state?.hit.trackIndex ?? hoverRef.current?.hit.trackIndex ?? 0
        onBarClick({ trackIndex, barIndex: bar.barIndex }, e.shiftKey)
        return
      }

      // Step 3: click landed in margins — clear any existing selection.
      onClearSelection?.()
    },
    [bridgeRef, containerRef, resolve, onBeatClick, onBarClick, onClearSelection, onSelectAll],
  )

  const handleDblClick = useCallback(
    (e: React.MouseEvent) => {
      const state = resolve(e) ?? hoverRef.current
      if (!state) return
      onBarDblClick?.(state.hit, e.shiftKey)
    },
    [resolve, onBarDblClick],
  )

  return { handleMouseMove, handleMouseLeave, handleClick, handleDblClick, hoverState, hoverRef }
}
