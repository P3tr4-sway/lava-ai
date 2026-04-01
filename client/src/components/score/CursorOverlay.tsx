import { cn } from '@/components/ui/utils'
import type { CursorMode } from '@/lib/cursorMath'

interface CursorOverlayProps {
  cursorMode: CursorMode
  displayX: number
  displayY: { top: number; bottom: number }
  overlaySize: { width: number; height: number }
  isSnapped: boolean
  className?: string
}

/**
 * SVG overlay rendering the cursor line for Select and Playback modes.
 * Positioned absolutely over the score canvas. pointer-events: none so
 * all clicks pass through to the score beneath.
 */
export function CursorOverlay({ cursorMode, displayX, displayY, overlaySize, isSnapped, className }: CursorOverlayProps) {
  if (cursorMode === 'hidden' || cursorMode === 'noteEntry') return null

  const isPlayback = cursorMode === 'playback'
  const stroke = isPlayback ? 'var(--text-muted)' : 'var(--accent)'
  const opacity = isPlayback ? 0.7 : isSnapped ? 1 : 0.8
  const lineHeight = Math.max(displayY.bottom - displayY.top, 0)

  return (
    <div
      className={cn('absolute left-0 top-0 overflow-visible', className)}
      style={{
        pointerEvents: 'none',
        width: Math.max(overlaySize.width, 1),
        height: Math.max(overlaySize.height, 1),
      }}
      aria-hidden="true"
    >
      <div
        className="absolute"
        style={{
          left: displayX,
          top: displayY.top,
          width: 1.5,
          height: lineHeight,
          backgroundColor: stroke,
          opacity,
          transform: 'translateX(-0.75px)',
          transition: 'opacity 150ms ease-out, background-color 150ms ease-out',
        }}
      />
    </div>
  )
}
