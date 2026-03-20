import { useRef, useEffect, useCallback } from 'react'
import type { Clip } from '@/audio/types'
import WaveSurfer from 'wavesurfer.js'

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
  const waveformRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)

  // ── Derived layout values ────────────────────────────────────────────────
  const visibleBars = clip.lengthInBars - clip.trimStart - clip.trimEnd
  const leftPx = clip.startBar * barWidthPx
  const widthPx = Math.max(visibleBars * barWidthPx, 8) // minimum 8px so handles remain reachable
  const heightPx = trackHeight - 4

  // Render waveform via wavesurfer.js whenever audioBuffer or sizing changes
  useEffect(() => {
    if (!waveformRef.current || !clip.audioBuffer) return

    // Destroy any previous instance
    wsRef.current?.destroy()

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: clip.color,
      progressColor: clip.color,
      height: heightPx - 18, // leave room for name label
      barWidth: widthPx < 60 ? 1 : 2,
      barGap: widthPx < 60 ? 0 : 1,
      barRadius: 1,
      cursorWidth: 0,
      interact: false,
      normalize: true,
      hideScrollbar: true,
    })

    const channelData = clip.audioBuffer.getChannelData(0)
    ws.load('', [channelData], clip.audioBuffer.duration)

    wsRef.current = ws

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [clip.audioBuffer, clip.color, heightPx, widthPx])

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

  // Background: clip color at 20% opacity for the body
  const bgColor = clip.color + '33'
  const isTemp = clip.status === 'temp'
  const isRecording = clip.status === 'recording'
  const hasError = Boolean(clip.errorMessage)

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
        hasError
          ? 'border-error/60'
          : selected
            ? 'border-white/40 ring-1 ring-white/50'
            : isTemp
              ? 'border-warning/60 border-dashed'
              : 'border-white/10',
        isRecording ? 'animate-pulse' : '',
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
          {isTemp && ' · queued'}
          {isRecording && ' · rec'}
          {hasError && ' · failed'}
        </div>

        {/* Waveform (wavesurfer.js) */}
        <div
          ref={waveformRef}
          className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
        />
      </div>

      {hasError && (
        <div className="absolute inset-x-0 bottom-0 px-1 py-0.5 text-[9px] bg-error/20 text-error truncate pointer-events-none">
          {clip.errorMessage}
        </div>
      )}

      {/* ── Right resize handle ────────────────────────────────── */}
      <div
        data-resize-handle="right"
        className="absolute right-0 top-0 w-2 h-full cursor-ew-resize z-10 hover:bg-white/20 transition-colors"
        onPointerDown={handleRightResizePointerDown}
      />
    </div>
  )
}
