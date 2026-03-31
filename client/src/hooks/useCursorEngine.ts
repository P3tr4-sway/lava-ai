// client/src/hooks/useCursorEngine.ts
import { useRef, useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useAudioStore } from '@/stores/audioStore'
import { lerp, computeSnapTarget, isSnapped as checkSnapped, deriveCursorMode } from '@/lib/cursorMath'
import type { CursorMode } from '@/lib/cursorMath'

const SNAP_RADIUS = 30
const SNAP_STRENGTH = 0.6
const SNAP_THRESHOLD = 5
const LERP_FACTOR = 0.3

interface CursorEngineState {
  cursorMode: CursorMode
  displayX: number
  displayY: { top: number; bottom: number }
  isSnapped: boolean
  /** Feed mouse position from the container's onMouseMove. */
  onMouseMove: (e: React.MouseEvent) => void
  /** Feed mouse leave to hide the cursor when mouse exits the score. */
  onMouseLeave: () => void
}

type GetMeasureBounds = (barIndex: number) => { x: number; y: number; width: number; height: number } | null

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
  const currentBar = useAudioStore((s) => s.currentBar)
  const currentTime = useAudioStore((s) => s.currentTime)
  const bpm = useAudioStore((s) => s.bpm)

  const cursorMode = deriveCursorMode(activeToolGroup, playbackState)

  // Internal animation state (refs to avoid re-renders every frame)
  const targetXRef = useRef(0)
  const displayXRef = useRef(0)
  const mouseActiveRef = useRef(false)
  const rafIdRef = useRef<number>(0)

  // Render state — only updated when values change meaningfully
  const [displayX, setDisplayX] = useState(0)
  const [isSnapped, setIsSnapped] = useState(false)

  // Container height for the cursor line extent
  const [displayY, setDisplayY] = useState<{ top: number; bottom: number }>({ top: 0, bottom: 0 })

  // Update container height on mount and resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => {
      setDisplayY({ top: 0, bottom: container.scrollHeight })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const rawX = e.clientX - rect.left + container.scrollLeft
    targetXRef.current = computeSnapTarget(rawX, snapPoints, SNAP_RADIUS, SNAP_STRENGTH)
    mouseActiveRef.current = true
  }, [containerRef, snapPoints])

  const onMouseLeave = useCallback(() => {
    mouseActiveRef.current = false
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
        // Lerp toward snapped target
        displayXRef.current = lerp(displayXRef.current, targetXRef.current, LERP_FACTOR)
        const snapped = checkSnapped(displayXRef.current, snapPoints, SNAP_THRESHOLD)
        setDisplayX(Math.round(displayXRef.current * 10) / 10)
        setIsSnapped(snapped)
      }

      if (cursorMode === 'playback') {
        // Compute position from audio time
        const barDuration = (60 / bpm) * 4 // assumes 4/4 — good enough for current usage
        const barBounds = getMeasureBounds(currentBar)
        const nextBarBounds = getMeasureBounds(currentBar + 1)

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

          // Scroll following: keep cursor at ~30% from left edge
          const container = containerRef.current
          if (container) {
            const viewportWidth = container.clientWidth
            const targetScroll = displayXRef.current - viewportWidth * 0.3
            const currentScroll = container.scrollLeft
            if (Math.abs(targetScroll - currentScroll) > viewportWidth * 0.4) {
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
  }, [cursorMode, snapPoints, bpm, currentBar, currentTime, getMeasureBounds, containerRef])

  return {
    cursorMode,
    displayX: mouseActiveRef.current || cursorMode === 'playback' ? displayX : -100,
    displayY,
    isSnapped,
    onMouseMove,
    onMouseLeave,
  }
}
