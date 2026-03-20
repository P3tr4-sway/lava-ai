import { useRef, useEffect, useCallback } from 'react'
import type { Clip } from '@/audio/types'
import { renderWaveformToCanvas } from '@/audio/waveform'

interface ClipViewProps {
  clip: Clip
  barWidthPx: number
  trackHeight: number
  selected: boolean
  snapEnabled: boolean
  onSelect: (clipId: string) => void
  onMove: (clipId: string, newStartBar: number) => void
  onResizeRight: (clipId: string, newLengthInBars: number) => void
  onResizeLeft: (clipId: string, newTrimStart: number, newStartBar: number) => void
}

export function ClipView({
  clip,
  barWidthPx,
  trackHeight,
  selected,
  snapEnabled,
  onSelect,
  onMove,
  onResizeRight,
  onResizeLeft,
}: ClipViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Render static waveform into canvas whenever peakData or color changes
  useEffect(() => {
    if (!canvasRef.current || !clip.peakData || clip.peakData.length === 0) return
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const cssWidth = canvas.offsetWidth
    const cssHeight = canvas.offsetHeight
    if (cssWidth === 0 || cssHeight === 0) return
    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    renderWaveformToCanvas(canvas, clip.peakData, clip.color)
  }, [clip.peakData, clip.color])

  // ── Snap helper ──────────────────────────────────────────────────────────
  const snapValue = useCallback(
    (value: number) => {
      if (snapEnabled) return Math.round(value)
      return Math.round(value * 4) / 4 // quarter-beat precision
    },
    [snapEnabled]
  )

  // ── Body drag (move) ─────────────────────────────────────────────────────
  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only handle direct clicks on this element; resize handles handle their own events
      if ((e.target as HTMLElement).dataset.resizeHandle) return
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

      const startX = e.clientX
      const startBar = clip.startBar

      const handleMove = (ev: PointerEvent) => {
        const deltaPx = ev.clientX - startX
        const deltaBar = deltaPx / barWidthPx
        const newBar = snapValue(startBar + deltaBar)
        onMove(clip.id, Math.max(0, newBar))
      }

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      onSelect(clip.id)
    },
    [clip.id, clip.startBar, barWidthPx, snapValue, onMove, onSelect]
  )

  // ── Right-edge resize ────────────────────────────────────────────────────
  const handleRightResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

      const startX = e.clientX
      const startLength = clip.lengthInBars

      const handleMove = (ev: PointerEvent) => {
        const deltaPx = ev.clientX - startX
        const deltaBar = deltaPx / barWidthPx
        const newLength = snapValue(startLength + deltaBar)
        onResizeRight(clip.id, Math.max(0.25, newLength))
      }

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      onSelect(clip.id)
    },
    [clip.id, clip.lengthInBars, barWidthPx, snapValue, onResizeRight, onSelect]
  )

  // ── Left-edge resize (adjusts trimStart + startBar) ──────────────────────
  const handleLeftResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

      const startX = e.clientX
      const originalTrimStart = clip.trimStart
      const originalStartBar = clip.startBar

      const handleMove = (ev: PointerEvent) => {
        const deltaPx = ev.clientX - startX
        const deltaBar = deltaPx / barWidthPx
        const rawTrimStart = originalTrimStart + deltaBar
        const clampedTrimStart = Math.max(
          0,
          Math.min(rawTrimStart, clip.lengthInBars - 0.25)
        )
        const snappedTrimStart = snapValue(clampedTrimStart)
        const trimDelta = snappedTrimStart - originalTrimStart
        const newStartBar = Math.max(0, originalStartBar + trimDelta)
        onResizeLeft(clip.id, snappedTrimStart, newStartBar)
      }

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      onSelect(clip.id)
    },
    [
      clip.id,
      clip.trimStart,
      clip.startBar,
      clip.lengthInBars,
      barWidthPx,
      snapValue,
      onResizeLeft,
      onSelect,
    ]
  )

  // ── Derived layout values ────────────────────────────────────────────────
  const visibleBars = clip.lengthInBars - clip.trimStart - clip.trimEnd
  const leftPx = clip.startBar * barWidthPx
  const widthPx = Math.max(visibleBars * barWidthPx, 8) // minimum 8px so handles remain reachable
  const heightPx = trackHeight - 4

  // Background: clip color at 20% opacity for the body
  const bgColor = clip.color + '33'

  return (
    <div
      style={{
        left: leftPx,
        width: widthPx,
        height: heightPx,
        backgroundColor: bgColor,
      }}
      className={[
        'absolute top-[2px] rounded overflow-hidden select-none',
        'border',
        selected ? 'border-white/40 ring-1 ring-white/50' : 'border-white/10',
        clip.isRecording ? 'animate-pulse' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(clip.id)}
    >
      {/* ── Left resize handle ─────────────────────────────────── */}
      <div
        data-resize-handle="left"
        className="absolute left-0 top-0 w-2 h-full cursor-ew-resize z-10 hover:bg-white/20 transition-colors"
        onPointerDown={handleLeftResizePointerDown}
      />

      {/* ── Clip content area (body drag target) ───────────────── */}
      <div
        className="absolute inset-0 ml-2 mr-2 cursor-grab active:cursor-grabbing"
        onPointerDown={handleBodyPointerDown}
      >
        {/* Top label */}
        <div
          style={{ color: clip.color }}
          className="text-[10px] px-1 py-0.5 truncate font-medium leading-tight pointer-events-none"
        >
          {clip.name}
        </div>

        {/* Waveform canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>

      {/* ── Right resize handle ────────────────────────────────── */}
      <div
        data-resize-handle="right"
        className="absolute right-0 top-0 w-2 h-full cursor-ew-resize z-10 hover:bg-white/20 transition-colors"
        onPointerDown={handleRightResizePointerDown}
      />
    </div>
  )
}
