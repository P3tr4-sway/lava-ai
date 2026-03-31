import { cn } from '@/components/ui/utils'
import type { CursorMode } from '@/lib/cursorMath'

interface CursorOverlayProps {
  cursorMode: CursorMode
  displayX: number
  displayY: { top: number; bottom: number }
  isSnapped: boolean
  className?: string
}

/**
 * SVG overlay rendering the cursor line for Select and Playback modes.
 * Positioned absolutely over the score canvas. pointer-events: none so
 * all clicks pass through to the score beneath.
 */
export function CursorOverlay({ cursorMode, displayX, displayY, isSnapped, className }: CursorOverlayProps) {
  if (cursorMode === 'hidden' || cursorMode === 'noteEntry') return null

  const isPlayback = cursorMode === 'playback'
  const stroke = isPlayback ? 'var(--text-muted)' : 'var(--accent)'
  const opacity = isPlayback ? 0.7 : isSnapped ? 1 : 0.8

  return (
    <svg
      className={cn('absolute inset-0 w-full h-full', className)}
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <line
        x1={displayX}
        y1={displayY.top}
        x2={displayX}
        y2={displayY.bottom}
        stroke={stroke}
        strokeWidth={1.5}
        opacity={opacity}
        style={{ transition: 'opacity 150ms ease-out, stroke 150ms ease-out' }}
      />
    </svg>
  )
}
