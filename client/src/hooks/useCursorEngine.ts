// client/src/hooks/useCursorEngine.ts
import { useRef, useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useAudioStore } from '@/stores/audioStore'
import { lerp, deriveCursorMode } from '@/lib/cursorMath'
import type { CursorMode, GetMeasureBounds } from '@/lib/cursorMath'

interface CursorEngineState {
  cursorMode: CursorMode
  displayX: number
  displayY: { top: number; bottom: number }
  overlaySize: { width: number; height: number }
  isSnapped: boolean
  /** Feed mouse position from the container's onMouseMove. */
  onMouseMove: (e: React.MouseEvent) => void
  /** Feed mouse leave to hide the cursor when mouse exits the score. */
  onMouseLeave: () => void
}

const CURSOR_MEASURE_OVERSCAN = 6

function findMeasureBoundsAtPointer(
  getMeasureBounds: GetMeasureBounds,
  pointer: { x: number; y: number },
) {
  let closestBounds: { x: number; y: number; width: number; height: number } | null = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < 500; index += 1) {
    const bounds = getMeasureBounds(index)
    if (!bounds) break

    const withinX = pointer.x >= bounds.x && pointer.x <= bounds.x + bounds.width
    const withinY = pointer.y >= bounds.y && pointer.y <= bounds.y + bounds.height
    if (withinX && withinY) {
      return bounds
    }

    const dx =
      pointer.x < bounds.x ? bounds.x - pointer.x
        : pointer.x > bounds.x + bounds.width ? pointer.x - (bounds.x + bounds.width)
          : 0
    const dy =
      pointer.y < bounds.y ? bounds.y - pointer.y
        : pointer.y > bounds.y + bounds.height ? pointer.y - (bounds.y + bounds.height)
          : 0
    const distance = Math.hypot(dx, dy)
    if (distance < closestDistance) {
      closestDistance = distance
      closestBounds = bounds
    }
  }

  return closestBounds
}

/**
 * Core cursor engine hook. Drives the CursorOverlay.
 * - Reads activeToolGroup + playbackState to derive cursor mode.
 * - In Select mode: tracks mouse with elastic snapping to beat 1.
 * - In Playback mode: animates cursor based on audio time + measure bounds.
 * - In NoteEntry/Hidden: no cursor line (CursorOverlay renders nothing).
 */
export function useCursorEngine(
  containerRef: RefObject<HTMLElement | null>,
  getMeasureBounds: GetMeasureBounds,
  snapPoints: number[],
): CursorEngineState {
  const activeToolGroup = useEditorStore((s) => s.activeToolGroup)
  const playbackState = useEditorStore((s) => s.playbackState)

  const cursorMode = deriveCursorMode(activeToolGroup, playbackState)

  // Internal animation state (refs to avoid re-renders every frame)
  const targetXRef = useRef(0)
  const displayXRef = useRef(0)
  const mouseActiveRef = useRef(false)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const rafIdRef = useRef<number>(0)

  // Fix 1: mouseActive state variable so hide-on-leave triggers a re-render
  const [mouseActive, setMouseActive] = useState(false)

  // Render state — only updated when values change meaningfully
  const [displayX, setDisplayX] = useState(0)
  const [isSnapped, setIsSnapped] = useState(false)

  // Cursor line vertical extent — derived from measure bounds in the rAF tick
  const [displayY, setDisplayY] = useState<{ top: number; bottom: number }>({ top: 0, bottom: 0 })
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 })

  // Keep getMeasureBounds stable for the playback rAF loop.
  const getMeasureBoundsRef = useRef(getMeasureBounds)

  useEffect(() => { getMeasureBoundsRef.current = getMeasureBounds }, [getMeasureBounds])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const rawX = e.clientX - rect.left + container.scrollLeft
    const rawY = e.clientY - rect.top + container.scrollTop
    const scrollHeight = Math.max(container.clientHeight, container.scrollHeight)
    const scrollWidth = Math.max(container.clientWidth, container.scrollWidth)

    targetXRef.current = rawX
    displayXRef.current = rawX
    pointerRef.current = { x: rawX, y: rawY }
    mouseActiveRef.current = true
    setDisplayX(Math.round(rawX * 10) / 10)
    setIsSnapped(false)
    const hoveredMeasureBounds = findMeasureBoundsAtPointer(getMeasureBoundsRef.current, { x: rawX, y: rawY })
    setDisplayY(hoveredMeasureBounds ? {
      top: hoveredMeasureBounds.y - CURSOR_MEASURE_OVERSCAN,
      bottom: hoveredMeasureBounds.y + hoveredMeasureBounds.height + CURSOR_MEASURE_OVERSCAN,
    } : {
      top: container.scrollTop,
      bottom: container.scrollTop + scrollHeight,
    })
    setOverlaySize({
      width: scrollWidth,
      height: scrollHeight,
    })
    setMouseActive(true)
  }, [containerRef])

  const onMouseLeave = useCallback(() => {
    mouseActiveRef.current = false
    // Fix 1: update state AND immediately push cursor off-screen
    setMouseActive(false)
    setDisplayX(-100)
  }, [])

  // Animation loop
  useEffect(() => {
    if (cursorMode === 'hidden' || cursorMode === 'noteEntry') {
      return
    }

    let running = true

    const tick = () => {
      if (!running) return

      if (cursorMode === 'select' && mouseActiveRef.current) {
        displayXRef.current = targetXRef.current
        setDisplayX(Math.round(displayXRef.current * 10) / 10)
        setIsSnapped(false)

        const container = containerRef.current
        if (container) {
          const scrollHeight = Math.max(container.clientHeight, container.scrollHeight)
          const scrollWidth = Math.max(container.clientWidth, container.scrollWidth)
          const pointer = pointerRef.current
          const hoveredMeasureBounds = pointer ? findMeasureBoundsAtPointer(getMeasureBoundsRef.current, pointer) : null
          setDisplayY(hoveredMeasureBounds ? {
            top: hoveredMeasureBounds.y - CURSOR_MEASURE_OVERSCAN,
            bottom: hoveredMeasureBounds.y + hoveredMeasureBounds.height + CURSOR_MEASURE_OVERSCAN,
          } : {
            top: container.scrollTop,
            bottom: container.scrollTop + scrollHeight,
          })
          setOverlaySize({
            width: scrollWidth,
            height: scrollHeight,
          })
        }
      }

      if (cursorMode === 'playback') {
        // Fix 2: fresh reads from store each frame — no stale closures
        const { currentBar, currentTime, bpm } = useAudioStore.getState()
        const barDuration = (60 / bpm) * 4 // assumes 4/4 — good enough for current usage
        // Fix 3: use getMeasureBoundsRef.current inside rAF tick
        const barBounds = getMeasureBoundsRef.current(currentBar)
        const nextBarBounds = getMeasureBoundsRef.current(currentBar + 1)

        if (barBounds) {
          if (nextBarBounds) {
            const barStartTime = currentBar * barDuration
            const fraction = Math.max(0, Math.min(1, (currentTime - barStartTime) / barDuration))
            const x = lerp(barBounds.x, nextBarBounds.x, fraction)
            displayXRef.current = x
          } else {
            displayXRef.current = barBounds.x
          }
          setDisplayX(Math.round(displayXRef.current * 10) / 10)
          setIsSnapped(false)

          // Cursor height should be slightly taller than the active measure row.
          setDisplayY({
            top: barBounds.y - CURSOR_MEASURE_OVERSCAN,
            bottom: barBounds.y + barBounds.height + CURSOR_MEASURE_OVERSCAN,
          })

          const container = containerRef.current
          if (container) {
            setOverlaySize({
              width: Math.max(container.clientWidth, container.scrollWidth),
              height: Math.max(container.clientHeight, container.scrollHeight),
            })
            const viewportWidth = container.clientWidth
            const cursorViewportX = displayXRef.current - container.scrollLeft
            if (cursorViewportX > viewportWidth * 0.4) {
              const targetScroll = displayXRef.current - viewportWidth * 0.3
              container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' })
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafIdRef.current)
    }
  }, [cursorMode, containerRef, snapPoints])

  return {
    cursorMode,
    displayX: mouseActive || cursorMode === 'playback' ? displayX : -100,
    displayY,
    overlaySize,
    isSnapped,
    onMouseMove,
    onMouseLeave,
  }
}
