import { useRef, useState, useCallback, useEffect } from 'react'

const COLLAPSED_HEIGHT = 56   // transport bar only
const DEFAULT_HEIGHT = 200    // transport + ~1 track
const MIN_HEIGHT = COLLAPSED_HEIGHT
const MAX_HEIGHT_VH = 0.65    // 65vh max

export type DawPanelSize = 'collapsed' | 'default' | 'expanded'

function snapHeight(h: number): number {
  const max = window.innerHeight * MAX_HEIGHT_VH
  return Math.max(MIN_HEIGHT, Math.min(max, h))
}

export function useDawResize() {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [size, setSize] = useState<DawPanelSize>('default')
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const frameRef = useRef<number>()

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startHeight: height }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [height])

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const delta = dragRef.current.startY - e.clientY   // drag up = bigger
    const newHeight = snapHeight(dragRef.current.startHeight + delta)
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      setHeight(newHeight)
      if (newHeight <= COLLAPSED_HEIGHT + 20) setSize('collapsed')
      else if (newHeight >= window.innerHeight * MAX_HEIGHT_VH - 20) setSize('expanded')
      else setSize('default')
    })
  }, [])

  const onHandlePointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  // Snap to preset sizes
  const collapse = useCallback(() => { setHeight(COLLAPSED_HEIGHT); setSize('collapsed') }, [])
  const expand = useCallback(() => {
    setHeight(Math.round(window.innerHeight * MAX_HEIGHT_VH))
    setSize('expanded')
  }, [])
  const resetDefault = useCallback(() => { setHeight(DEFAULT_HEIGHT); setSize('default') }, [])

  useEffect(() => () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }, [])

  return {
    height,
    size,
    collapse,
    expand,
    resetDefault,
    handleProps: {
      onPointerDown: onHandlePointerDown,
      onPointerMove: onHandlePointerMove,
      onPointerUp: onHandlePointerUp,
    },
  }
}
