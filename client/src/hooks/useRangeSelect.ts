import { useState, useCallback } from 'react'
import type { RefObject } from 'react'
import type React from 'react'
import { useEditorStore } from '@/stores/editorStore'

interface Box {
  x: number
  y: number
  width: number
  height: number
}

type GetMeasureBounds = (barIndex: number) => { x: number; y: number; width: number; height: number } | null

interface RangeSelectState {
  isDragging: boolean
  selectionBox: Box | null
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
}

/**
 * Handles mouse-drag range selection on the score.
 * Only activates when toolMode === 'range'.
 * Reads measure bounds via getMeasureBounds to determine which bars are covered.
 */
export function useRangeSelect(
  containerRef: RefObject<HTMLElement | null>,
  getMeasureBounds: GetMeasureBounds,
): RangeSelectState {
  const toolMode = useEditorStore((s) => s.toolMode)
  const selectRange = useEditorStore((s) => s.selectRange)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  const [isDragging, setIsDragging] = useState(false)
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null)
  const [selectionBox, setSelectionBox] = useState<Box | null>(null)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (toolMode !== 'range') return
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setStartPt({ x, y })
      setIsDragging(true)
      setSelectionBox({ x, y, width: 0, height: 0 })
      clearSelection()
    },
    [toolMode, containerRef, clearSelection],
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !startPt) return
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const curX = e.clientX - rect.left
      const curY = e.clientY - rect.top
      const box: Box = {
        x: Math.min(startPt.x, curX),
        y: Math.min(startPt.y, curY),
        width: Math.abs(curX - startPt.x),
        height: Math.abs(curY - startPt.y),
      }
      setSelectionBox(box)
    },
    [isDragging, startPt, containerRef],
  )

  const onMouseUp = useCallback(() => {
    if (!isDragging || !selectionBox) {
      setIsDragging(false)
      setStartPt(null)
      setSelectionBox(null)
      return
    }

    // Find all measures whose bounds intersect the selection box
    // Scan measure indices 0..N by querying getMeasureBounds until null
    const coveredBars: number[] = []
    for (let i = 0; i < 500; i++) {
      const bounds = getMeasureBounds(i)
      if (!bounds) break
      if (rectsOverlap(selectionBox, bounds)) {
        coveredBars.push(i)
      }
    }

    if (coveredBars.length >= 2) {
      selectRange(coveredBars[0], coveredBars[coveredBars.length - 1])
    } else if (coveredBars.length === 1) {
      selectRange(coveredBars[0], coveredBars[0])
    }

    setIsDragging(false)
    setStartPt(null)
    setSelectionBox(null)
  }, [isDragging, selectionBox, getMeasureBounds, selectRange])

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
