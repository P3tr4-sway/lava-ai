import { useRef, useEffect } from 'react'
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

    let mounted = true

    // Destroy any previous instance
    wsRef.current?.destroy()

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: clip.color,
      progressColor: clip.color,
      height: heightPx - 22, // container is offset 18px below label + 4px padding
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

    ws.on('error', (err) => {
      console.error('WaveSurfer load failed:', err)
    })

    wsRef.current = ws

    return () => {
      mounted = false
      ws.destroy()
      wsRef.current = null
    }
  }, [clip.audioBuffer, clip.color, heightPx, widthPx])

  // ── Drag / resize state (ref avoids stale closures on re-render) ─────────
  type DragMode = 'move' | 'resize-right' | 'resize-left'
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startBar: number
    startLength: number
    startTrimStart: number
  } | null>(null)

  const applySnap = (value: number) =>
    snapEnabled ? Math.round(value) : value

  // ── Body drag (move) ─────────────────────────────────────────────────────
  const handleBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.resizeHandle) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: 'move',
      startX: e.clientX,
      startBar: clip.startBar,
      startLength: clip.lengthInBars,
      startTrimStart: clip.trimStart,
    }
    onSelect(clip.id)
  }

  const handleBodyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.mode !== 'move') return
    const deltaBar = (e.clientX - drag.startX) / barWidthPx
    const newBar = applySnap(drag.startBar + deltaBar)
    onMove(clip.id, Math.max(0, newBar))
  }

  const handleBodyPointerUp = () => {
    dragRef.current = null
  }

  // ── Right-edge resize ────────────────────────────────────────────────────
  const handleRightResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: 'resize-right',
      startX: e.clientX,
      startBar: clip.startBar,
      startLength: clip.lengthInBars,
      startTrimStart: clip.trimStart,
    }
    onSelect(clip.id)
  }

  const handleRightResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.mode !== 'resize-right') return
    const deltaBar = (e.clientX - drag.startX) / barWidthPx
    const newLength = applySnap(drag.startLength + deltaBar)
    onResizeRight(clip.id, Math.max(0.25, newLength))
  }

  // ── Left-edge resize (adjusts trimStart + startBar) ──────────────────────
  const handleLeftResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode: 'resize-left',
      startX: e.clientX,
      startBar: clip.startBar,
      startLength: clip.lengthInBars,
      startTrimStart: clip.trimStart,
    }
    onSelect(clip.id)
  }

  const handleLeftResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.mode !== 'resize-left') return
    const deltaBar = (e.clientX - drag.startX) / barWidthPx
    const rawTrimStart = drag.startTrimStart + deltaBar
    const clampedTrimStart = Math.max(0, Math.min(rawTrimStart, clip.lengthInBars - 0.25))
    const snappedTrimStart = applySnap(clampedTrimStart)
    const trimDelta = snappedTrimStart - drag.startTrimStart
    onResizeLeft(clip.id, snappedTrimStart, Math.max(0, drag.startBar + trimDelta))
  }

  const handlePointerUp = () => {
    dragRef.current = null
  }

  // Background: clip color at 20% opacity for the body
  const bgColor = clip.color + '33'
  const isTemp = clip.status === 'temp'
  const isRecording = clip.status === 'recording'
  const hasError = Boolean(clip.errorMessage)

  return (
    <div
      role="region"
      aria-label={clip.name || 'Audio clip'}
      style={{
        left: leftPx,
        width: widthPx,
        height: heightPx,
        backgroundColor: bgColor,
        boxShadow: selected
          ? 'inset 0 0 0 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.4)'
          : hasError
            ? 'inset 0 0 0 1px rgba(239,68,68,0.8)'
            : undefined,
        filter: selected ? 'brightness(1.2)' : undefined,
      }}
      className={[
        'absolute top-[2px] rounded overflow-hidden select-none',
        isTemp && !selected ? 'border border-dashed border-white/40' : 'border-0',
        isRecording ? 'animate-pulse' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(clip.id)}
    >
      {/* ── Left resize handle ─────────────────────────────────── */}
      <div
        data-resize-handle="left"
        aria-label="Resize clip start"
        className="absolute left-0 top-0 w-2 h-full cursor-ew-resize z-10 hover:bg-text-primary/20 transition-colors"
        onPointerDown={handleLeftResizePointerDown}
        onPointerMove={handleLeftResizePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Selected overlay */}
      {selected && (
        <div className="absolute inset-0 bg-text-primary/10 pointer-events-none z-10" />
      )}

      {/* ── Clip content area (body drag target) ───────────────── */}
      <div
        className="absolute inset-0 ml-2 mr-2 cursor-grab active:cursor-grabbing"
        onPointerDown={handleBodyPointerDown}
        onPointerMove={handleBodyPointerMove}
        onPointerUp={handleBodyPointerUp}
      >
        {/* Top label */}
        <div
          style={{ color: clip.color }}
          className="relative z-10 text-[10px] px-1 py-0.5 truncate font-medium leading-tight pointer-events-none"
        >
          {clip.name}
          {isTemp && ' · queued'}
          {isRecording && ' · rec'}
          {hasError && ' · failed'}
        </div>

        {/* Waveform (wavesurfer.js) — positioned below the label */}
        <div
          ref={waveformRef}
          className="absolute inset-x-0 bottom-0 top-[18px] pointer-events-none overflow-hidden"
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
        aria-label="Resize clip end"
        className="absolute right-0 top-0 w-2 h-full cursor-ew-resize z-10 hover:bg-text-primary/20 transition-colors"
        onPointerDown={handleRightResizePointerDown}
        onPointerMove={handleRightResizePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  )
}
