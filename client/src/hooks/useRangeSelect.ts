import { useState, useRef, useCallback } from 'react'
import type { RefObject } from 'react'
import type React from 'react'
import { useEditorStore } from '@/stores/editorStore'
import type { GetMeasureBounds } from '@/lib/cursorMath'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

// Upper bound for measure scan — guards against getMeasureBounds never returning null
const MAX_MEASURES = 500

interface RangeSelectState {
  isDragging: boolean
  selectionBox: Box | null
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
}

/**
 * Handles mouse-drag range selection on the score.
 * Only activates when activeToolGroup === 'selection'.
 * Reads measure bounds via getMeasureBounds to determine which bars are covered.
 *
 * Drag state (isDraggingRef, startPtRef, selectionBoxRef) is stored in refs so
 * onMouseMove can always read the latest values without needing to be recreated
 * on every state change, avoiding the stale-closure window between mousedown and
 * the next render.
 */
export function useRangeSelect(
  containerRef: RefObject<HTMLElement | null>,
  getMeasureBounds: GetMeasureBounds,
): RangeSelectState {
  const activeToolGroup = useEditorStore((s) => s.activeToolGroup)
  const selectRange = useEditorStore((s) => s.selectRange)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  // Render-triggering state (for component to react to drag)
  const [isDragging, setIsDragging] = useState(false)
  const [selectionBox, setSelectionBox] = useState<Box | null>(null)

  // Refs for always-current values inside callbacks
  const isDraggingRef = useRef(false)
  const startPtRef = useRef<{ x: number; y: number } | null>(null)
  const selectionBoxRef = useRef<Box | null>(null)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeToolGroup !== 'selection') return
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const box: Box = { x, y, width: 0, height: 0 }
      startPtRef.current = { x, y }
      selectionBoxRef.current = box
      isDraggingRef.current = true
      setIsDragging(true)
      setSelectionBox(box)
      clearSelection()
    },
    [activeToolGroup, containerRef, clearSelection],
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current || !startPtRef.current) return
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const curX = e.clientX - rect.left
      const curY = e.clientY - rect.top
      const startPt = startPtRef.current
      const box: Box = {
        x: Math.min(startPt.x, curX),
        y: Math.min(startPt.y, curY),
        width: Math.abs(curX - startPt.x),
        height: Math.abs(curY - startPt.y),
      }
      selectionBoxRef.current = box
      setSelectionBox(box)
    },
    [containerRef],
  )

  const onMouseUp = useCallback(() => {
    const box = selectionBoxRef.current
    if (!isDraggingRef.current || !box) {
      isDraggingRef.current = false
      startPtRef.current = null
      selectionBoxRef.current = null
      setIsDragging(false)
      setSelectionBox(null)
      return
    }

    // Find all measures whose bounds intersect the selection box
    const coveredBars: number[] = []
    for (let i = 0; i < MAX_MEASURES; i++) {
      const bounds = getMeasureBounds(i)
      if (!bounds) break
      if (rectsOverlap(box, bounds)) {
        coveredBars.push(i)
      }
    }

    if (coveredBars.length >= 2) {
      selectRange(coveredBars[0], coveredBars[coveredBars.length - 1])
    } else if (coveredBars.length === 1) {
      selectRange(coveredBars[0], coveredBars[0])
    }

    isDraggingRef.current = false
    startPtRef.current = null
    selectionBoxRef.current = null
    setIsDragging(false)
    setSelectionBox(null)
  }, [getMeasureBounds, selectRange])

  return { isDragging, selectionBox, onMouseDown, onMouseMove, onMouseUp }
}

function rectsOverlap(a: Box, b: { x: number; y: number; width: number; height: number }): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}
